import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type UploadItemKind = "receipt_image" | "voice_note" | "pdf_document" | "unknown";
type UploadBatchKind =
  | "receipt_image_batch"
  | "voice_batch"
  | "pdf_batch"
  | "mixed_batch";
type UploadDraftType = "expense" | "time" | "task" | "revenue" | "unknown";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function getIntakeUploadsBucket() {
  return (
    process.env.INTAKE_UPLOADS_BUCKET ||
    process.env.SUPABASE_INTAKE_UPLOADS_BUCKET ||
    "intake-uploads"
  ).trim();
}

function adminClient() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getPortalContext(req: Request) {
  const token = bearerFromReq(req);
  if (!token) return { ok: false as const, error: "Missing bearer token." };

  const admin = adminClient();

  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    return { ok: false as const, error: "Invalid session." };
  }

  const authUserId = String(authData.user.id);

  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr) return { ok: false as const, error: puErr.message || "Failed to resolve tenant." };
  if (!pu?.tenant_id) return { ok: false as const, error: "Missing tenant context." };

  const tenantId = String(pu.tenant_id);

  const { data: tenant, error: tErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tErr) return { ok: false as const, error: tErr.message || "Failed to resolve owner." };
  if (!tenant?.owner_id) return { ok: false as const, error: "Missing owner context." };

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId,
    ownerId: String(tenant.owner_id),
    role: String(pu.role || ""),
  };
}

function classifyFile(file: File): {
  itemKind: UploadItemKind;
  batchKind: UploadBatchKind;
  draftType: UploadDraftType;
} {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  if (mime.startsWith("image/")) {
    return { itemKind: "receipt_image", batchKind: "receipt_image_batch", draftType: "expense" };
  }

  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(name)) {
    return { itemKind: "voice_note", batchKind: "voice_batch", draftType: "unknown" };
  }

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return { itemKind: "pdf_document", batchKind: "pdf_batch", draftType: "expense" };
  }

  return { itemKind: "unknown", batchKind: "mixed_batch", draftType: "unknown" };
}

function detectBatchKind(files: File[]): UploadBatchKind {
  const kinds = new Set(files.map((f) => classifyFile(f).batchKind));
  if (kinds.size === 1) return Array.from(kinds)[0] as UploadBatchKind;
  return "mixed_batch";
}

function extensionFromFile(file: File) {
  const filename = String(file.name || "").trim();
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  return String(ext || "bin")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase() || "bin";
}

function initialValidationFlags(kind: UploadItemKind) {
  const flags: string[] = [];

  if (kind === "receipt_image") flags.push("ocr_pending");
  if (kind === "pdf_document") flags.push("pdf_text_empty");
  if (kind === "voice_note") flags.push("voice_transcript_low_confidence");
  if (kind === "unknown") flags.push("unsupported_file_type");

  return flags;
}

function buildInitialRawModelOutput(input: {
  itemKind: UploadItemKind;
  draftType: UploadDraftType;
  file: File;
  storageBucket: string;
  storagePath: string;
  sourceHash: string;
}) {
  return {
    pipeline_version: "phase1-upload-normalize-v1",
    normalize: {
      kind: input.itemKind,
      draft_type: input.draftType,
      mime_type: input.file.type || null,
      source_filename: input.file.name || null,
      source_size_bytes: Number(input.file.size || 0),
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      source_hash: input.sourceHash,
      uploaded_at: new Date().toISOString(),
    },
    extract: {
      source: "none",
      text_present: false,
      text_preview: "",
      candidate_fields: {
        amount_cents: null,
        currency: null,
        vendor: null,
        description: null,
        event_date: null,
        subtotal_cents: null,
        tax_cents: null,
        total_cents: null,
        job_name: null,
      },
    },
    validate: {
      confidence_score: input.itemKind === "unknown" ? 0.05 : 0.12,
      validation_flags: initialValidationFlags(input.itemKind),
      required_review: true,
    },
    enrich: {
      review_summary:
        input.itemKind === "unknown"
          ? "Unsupported file type uploaded. Evidence preserved for owner review."
          : "Upload normalized successfully. Extraction has not been completed yet.",
      suggested_job_terms: [],
      explain_amount_source: "No amount source yet. Extraction has not been completed.",
      explain_vendor_source: "No vendor source yet. Extraction has not been completed.",
      kind: input.itemKind,
    },
  };
}

export async function POST(req: Request) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "board")) {
      return json(403, {
        ok: false,
        error: "Owner-only or approver-only action.",
        code: "PERMISSION_DENIED",
      });
    }

    const form = await req.formData();
    const incoming = form.getAll("files").filter(Boolean) as File[];

    if (!incoming.length) {
      return json(400, { ok: false, error: "No files uploaded." });
    }

    const files = incoming.filter((f) => typeof f?.name === "string" && Number(f.size || 0) > 0);
    if (!files.length) {
      return json(400, { ok: false, error: "Uploaded files were empty." });
    }

    const batchKind = detectBatchKind(files);
    const storageBucket = getIntakeUploadsBucket();

    const { data: batch, error: batchErr } = await ctx.admin
      .from("intake_batches")
      .insert({
        tenant_id: ctx.tenantId,
        owner_id: ctx.ownerId,
        created_by_auth_user_id: ctx.authUserId,
        kind: batchKind,
        status: "uploaded",
        total_items: files.length,
      })
      .select("*")
      .single();

    if (batchErr || !batch?.id) {
      return json(500, { ok: false, error: batchErr?.message || "Failed to create batch." });
    }

    const uploadedItemIds: string[] = [];
    const duplicateItemIds: string[] = [];
    const seenHashesInRequest = new Map<string, string>();

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const sourceHash = crypto.createHash("sha256").update(buffer).digest("hex");
      const ext = extensionFromFile(file);
      const objectPath = `${ctx.tenantId}/${batch.id}/${crypto.randomUUID()}.${ext}`;
      const kind = classifyFile(file);

      const upload = await ctx.admin.storage
        .from(storageBucket)
        .upload(objectPath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upload.error) {
        const msg = String(upload.error.message || "");
        const isMissingBucket = /bucket.*not.*found/i.test(msg);

        return json(500, {
          ok: false,
          code: isMissingBucket ? "STORAGE_BUCKET_MISSING" : "STORAGE_UPLOAD_FAILED",
          error: upload.error.message || "Storage upload failed.",
          hint: isMissingBucket
            ? `Confirm the private Supabase bucket "${storageBucket}" exists in the production project.`
            : undefined,
          bucket: storageBucket,
        });
      }

      let duplicateOfItemId: string | null = null;
      let status: string = "uploaded";

      const duplicateInSameRequest = seenHashesInRequest.get(sourceHash);
      if (duplicateInSameRequest) {
        duplicateOfItemId = duplicateInSameRequest;
        status = "duplicate";
      } else {
        const { data: priorDuplicate } = await ctx.admin
          .from("intake_items")
          .select("id")
          .eq("tenant_id", ctx.tenantId)
          .eq("source_hash", sourceHash)
          .in("status", ["confirmed", "persisted"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (priorDuplicate?.id) {
          duplicateOfItemId = String(priorDuplicate.id);
          status = "duplicate";
        }
      }

      const { data: item, error: itemErr } = await ctx.admin
        .from("intake_items")
        .insert({
          batch_id: batch.id,
          tenant_id: ctx.tenantId,
          owner_id: ctx.ownerId,
          created_by_auth_user_id: ctx.authUserId,
          kind: kind.itemKind,
          status,
          storage_bucket: storageBucket,
          storage_path: objectPath,
          source_filename: file.name,
          mime_type: file.type || null,
          source_hash: sourceHash,
          draft_type: kind.draftType,
          duplicate_of_item_id: duplicateOfItemId,
          confidence_score: kind.itemKind === "unknown" ? 0.05 : 0.12,
        })
        .select("id")
        .single();

      if (itemErr || !item?.id) {
        return json(500, { ok: false, error: itemErr?.message || "Failed to create intake item." });
      }

      const validationFlags = initialValidationFlags(kind.itemKind);
      if (duplicateOfItemId) {
        validationFlags.push("possible_duplicate_content");
      }

      const rawModelOutput = buildInitialRawModelOutput({
        itemKind: kind.itemKind,
        draftType: kind.draftType,
        file,
        storageBucket,
        storagePath: objectPath,
        sourceHash,
      });

      const { error: draftErr } = await ctx.admin
        .from("intake_item_drafts")
        .insert({
          intake_item_id: item.id,
          tenant_id: ctx.tenantId,
          owner_id: ctx.ownerId,
          draft_type: kind.draftType,
          amount_cents: null,
          currency: null,
          vendor: null,
          description: null,
          event_date: null,
          job_int_id: null,
          job_name: null,
          raw_model_output: rawModelOutput,
          validation_flags: Array.from(new Set(validationFlags)),
        });

      if (draftErr) {
        return json(500, {
          ok: false,
          error: draftErr.message || "Failed to create initial intake draft.",
        });
      }

      const { error: reviewErr } = await ctx.admin
        .from("intake_item_reviews")
        .insert({
          intake_item_id: item.id,
          tenant_id: ctx.tenantId,
          owner_id: ctx.ownerId,
          reviewed_by_auth_user_id: ctx.authUserId,
          action: "reject",
          before_payload: {},
          after_payload: {
            event: "upload_normalized",
            duplicate_of_item_id: duplicateOfItemId,
            initial_flags: Array.from(new Set(validationFlags)),
            pipeline_version: "phase1-upload-normalize-v1",
          },
          comment: "Initial normalized upload record created. No domain mutation performed.",
        });

      if (reviewErr) {
        return json(500, {
          ok: false,
          error: reviewErr.message || "Failed to write intake review history.",
        });
      }

      uploadedItemIds.push(String(item.id));
      if (duplicateOfItemId) duplicateItemIds.push(String(item.id));
      if (!seenHashesInRequest.has(sourceHash)) {
        seenHashesInRequest.set(sourceHash, String(item.id));
      }
    }

    const hasNonDuplicateItems = uploadedItemIds.length > duplicateItemIds.length;

    const { error: batchUpdateErr } = await ctx.admin
      .from("intake_batches")
      .update({
        status: hasNonDuplicateItems ? "uploaded" : "pending_review",
        duplicate_items: duplicateItemIds.length,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", batch.id);

    if (batchUpdateErr) {
      return json(500, {
        ok: false,
        error: batchUpdateErr.message || "Failed to update intake batch status.",
      });
    }

    return json(200, {
      ok: true,
      batchId: String(batch.id),
      uploadedCount: uploadedItemIds.length,
      duplicateCount: duplicateItemIds.length,
      itemIds: uploadedItemIds,
      bucket: storageBucket,
      message:
        duplicateItemIds.length > 0
          ? "Files uploaded and normalized. Some items were flagged as possible duplicates for owner review."
          : "Files uploaded and normalized successfully.",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Upload failed." });
  }
}