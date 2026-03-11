import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  if (authErr || !authData?.user?.id) return { ok: false as const, error: "Invalid session." };

  const authUserId = String(authData.user.id);

  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr) return { ok: false as const, error: puErr.message || "Failed to resolve membership." };
  if (!pu?.tenant_id) return { ok: false as const, error: "Missing tenant context." };

  const { data: tenant, error: tErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", pu.tenant_id)
    .single();

  if (tErr || !tenant?.owner_id) {
    return { ok: false as const, error: tErr?.message || "Missing owner context." };
  }

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId: String(pu.tenant_id),
    ownerId: String(tenant.owner_id),
    role: String(pu.role || ""),
  };
}

function draftFromMime(mime: string | null, filename: string | null) {
  const m = String(mime || "").toLowerCase();
  const f = String(filename || "").toLowerCase();

  if (m.startsWith("image/")) return { draftType: "expense", kind: "receipt_image" };
  if (m.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg)$/i.test(f)) {
    return { draftType: "unknown", kind: "voice_note" };
  }
  if (m === "application/pdf" || f.endsWith(".pdf")) return { draftType: "expense", kind: "pdf_document" };
  return { draftType: "unknown", kind: "unknown" };
}

export async function POST(req: Request) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "board")) {
      return json(403, { ok: false, error: "Owner-only or approver-only action." });
    }

    const body = await req.json().catch(() => ({}));
    const batchId = String(body?.batchId || "").trim();
    if (!batchId) return json(400, { ok: false, error: "Missing batchId." });

    const { data: items, error: itemsErr } = await ctx.admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("batch_id", batchId);

    if (itemsErr) return json(500, { ok: false, error: itemsErr.message || "Failed to load batch items." });

    const rows = items || [];

    for (const item of rows) {
      const inferred = draftFromMime(item.mime_type, item.source_filename);

      const validationFlags: string[] = [];
      if (!item.job_name) validationFlags.push("job_unresolved");
      if (inferred.kind === "unknown") validationFlags.push("unknown_file_type");
      if (inferred.kind === "pdf_document") validationFlags.push("pdf_parse_pending");
      if (inferred.kind === "voice_note") validationFlags.push("transcript_pending");
      if (inferred.kind === "receipt_image") validationFlags.push("ocr_pending");

      const existingDraft = await ctx.admin
        .from("intake_item_drafts")
        .select("id")
        .eq("intake_item_id", item.id)
        .maybeSingle();

      if (!existingDraft.data?.id) {
        await ctx.admin.from("intake_item_drafts").insert({
          intake_item_id: item.id,
          tenant_id: ctx.tenantId,
          owner_id: ctx.ownerId,
          draft_type: inferred.draftType,
          raw_model_output: {
            placeholder: true,
            note: "Phase 1 skeleton draft. Replace with layered parsing pipeline output.",
          },
          validation_flags: validationFlags,
        });
      }

      await ctx.admin
        .from("intake_items")
        .update({
          draft_type: inferred.draftType,
          kind: inferred.kind,
          status: "pending_review",
          updated_at: new Date().toISOString(),
          confidence_score: inferred.kind === "unknown" ? 0.1 : 0.4,
        })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", item.id);
    }

    await ctx.admin
      .from("intake_batches")
      .update({
        status: "pending_review",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", batchId);

    return json(200, {
      ok: true,
      batchId,
      processedCount: rows.length,
      message: "Batch moved into pending review.",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Processing failed." });
  }
}