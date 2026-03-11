import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function classifyFile(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  if (mime.startsWith("image/")) {
    return { itemKind: "receipt_image", batchKind: "receipt_image_batch", draftType: "expense" };
  }

  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg)$/i.test(name)) {
    return { itemKind: "voice_note", batchKind: "voice_batch", draftType: "unknown" };
  }

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    return { itemKind: "pdf_document", batchKind: "pdf_batch", draftType: "expense" };
  }

  return { itemKind: "unknown", batchKind: "mixed_batch", draftType: "unknown" };
}

function detectBatchKind(files: File[]) {
  const kinds = new Set(files.map((f) => classifyFile(f).batchKind));
  if (kinds.size === 1) return Array.from(kinds)[0];
  return "mixed_batch";
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

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      const ext = String(file.name || "").split(".").pop() || "bin";
      const objectPath = `${ctx.tenantId}/${batch.id}/${crypto.randomUUID()}.${ext}`;

      const upload = await ctx.admin.storage
        .from("intake-uploads")
        .upload(objectPath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upload.error) {
        return json(500, {
          ok: false,
          error: upload.error.message || "Storage upload failed.",
          hint: "Confirm the private bucket intake-uploads exists.",
        });
      }

      const kind = classifyFile(file);

      const { data: item, error: itemErr } = await ctx.admin
        .from("intake_items")
        .insert({
          batch_id: batch.id,
          tenant_id: ctx.tenantId,
          owner_id: ctx.ownerId,
          created_by_auth_user_id: ctx.authUserId,
          kind: kind.itemKind,
          status: "uploaded",
          storage_bucket: "intake-uploads",
          storage_path: objectPath,
          source_filename: file.name,
          mime_type: file.type || null,
          source_hash: hash,
          draft_type: kind.draftType,
        })
        .select("id")
        .single();

      if (itemErr || !item?.id) {
        return json(500, { ok: false, error: itemErr?.message || "Failed to create intake item." });
      }

      uploadedItemIds.push(String(item.id));
    }

    return json(200, {
      ok: true,
      batchId: String(batch.id),
      uploadedCount: uploadedItemIds.length,
      itemIds: uploadedItemIds,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Upload failed." });
  }
}