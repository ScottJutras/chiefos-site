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

async function getTenantContext(req: Request) {
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

  if (puErr) return { ok: false as const, error: puErr.message || "Failed to resolve membership." };
  if (!pu?.tenant_id) return { ok: false as const, error: "Missing tenant context." };

  return {
    ok: true as const,
    admin,
    tenantId: String(pu.tenant_id),
    role: String(pu.role || ""),
  };
}

function normalizeFlags(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim()).filter(Boolean);
  }
  return [];
}

function hasBlockingFlags(flags: string[]) {
  const blocking = new Set([
    "missing_amount",
    "missing_vendor",
    "missing_date",
    "job_unresolved",
    "job_ambiguous",
    "possible_duplicate_attachment",
    "possible_duplicate_content",
    "unsupported_file_type",
  ]);

  return flags.some((flag) => blocking.has(String(flag || "")));
}

function isReadyForFastConfirm(row: any) {
  const status = String(row?.status || "").trim();
  const confidence = Number(row?.confidence_score || 0);
  const jobName = String(row?.job_name || row?.draft_job_name || "").trim();
  const amount = Number(row?.draft_amount_cents || 0);
  const vendor = String(row?.draft_vendor || "").trim();
  const eventDate = String(row?.draft_event_date || "").trim();
  const flags = normalizeFlags(row?.draft_validation_flags);

  if (status !== "pending_review") return false;
  if (confidence < 0.85) return false;
  if (!jobName) return false;
  if (!amount || amount <= 0) return false;
  if (!vendor) return false;
  if (!eventDate) return false;
  if (hasBlockingFlags(flags)) return false;

  return true;
}

function compareRowsForReview(a: any, b: any) {
  const aReady = isReadyForFastConfirm(a) ? 1 : 0;
  const bReady = isReadyForFastConfirm(b) ? 1 : 0;

  if (aReady !== bReady) return bReady - aReady;

  const aConfidence = Number(a?.confidence_score || 0);
  const bConfidence = Number(b?.confidence_score || 0);
  if (aConfidence !== bConfidence) return bConfidence - aConfidence;

  const aCreated = new Date(String(a?.created_at || 0)).getTime();
  const bCreated = new Date(String(b?.created_at || 0)).getTime();
  return bCreated - aCreated;
}

function escapeLikeQuery(value: string) {
  // Escape LIKE special chars, then strip PostgREST filter-syntax chars (comma splits conditions)
  return value.replace(/[%_]/g, "\\$&").replace(/[,()]/g, "");
}

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    const admin = ctx.admin;
    const url = new URL(req.url);

    const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const kind = String(url.searchParams.get("kind") || "").trim();
    const batchId = String(url.searchParams.get("batchId") || "").trim();
    const q = String(url.searchParams.get("q") || "").trim();

    // Pull a slightly larger server-side slice first, then rank in memory.
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 200)));
    const onlyFastConfirm = String(url.searchParams.get("fastConfirm") || "").trim() === "1";
    const includeDeleted = String(url.searchParams.get("includeDeleted") || "").trim() === "1";

    let itemQuery = admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!includeDeleted) {
      itemQuery = itemQuery.neq("status", "deleted");
    }

    if (status && status !== "all") {
      itemQuery = itemQuery.eq("status", status);
    }

    if (kind) {
      itemQuery = itemQuery.eq("kind", kind);
    }

    if (batchId) {
      itemQuery = itemQuery.eq("batch_id", batchId);
    }

    if (q) {
      const escaped = escapeLikeQuery(q);
      const token = `%${escaped}%`;
      itemQuery = itemQuery.or(
        `source_filename.ilike.${token},job_name.ilike.${token},ocr_text.ilike.${token},transcript_text.ilike.${token}`
      );
    }

    const { data: items, error: itemsErr } = await itemQuery;

    if (itemsErr) {
      return json(500, { ok: false, error: itemsErr.message || "Failed to load intake items." });
    }

    const rows = Array.isArray(items) ? items : [];
    const itemIds = rows.map((row) => String(row.id)).filter(Boolean);

    let draftMap = new Map<string, any>();

    if (itemIds.length > 0) {
      const { data: drafts, error: draftsErr } = await admin
        .from("intake_item_drafts")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .in("intake_item_id", itemIds);

      if (draftsErr) {
        return json(500, { ok: false, error: draftsErr.message || "Failed to load intake drafts." });
      }

      draftMap = new Map(
        (drafts || []).map((draft: any) => [String(draft.intake_item_id), draft])
      );
    }

    const enrichedRows = rows.map((row: any) => {
      const draft = draftMap.get(String(row.id)) || null;
      const draftFlags = normalizeFlags(draft?.validation_flags);

      const merged = {
        ...row,
        draft_amount_cents: draft?.amount_cents ?? null,
        draft_currency: draft?.currency ?? null,
        draft_vendor: draft?.vendor ?? null,
        draft_description: draft?.description ?? null,
        draft_event_date: draft?.event_date ?? null,
        draft_job_name: draft?.job_name ?? null,
        draft_validation_flags: draftFlags,
        draft_subtotal_cents: (draft?.raw_model_output as any)?.extract?.candidate_fields?.subtotal_cents ?? null,
        draft_tax_cents: (draft?.raw_model_output as any)?.extract?.candidate_fields?.tax_cents ?? null,
        draft_tax_label: (draft?.raw_model_output as any)?.tax_label ?? null,
        draft_line_items: (draft?.raw_model_output as any)?.line_items ?? null,
      };

      return {
        ...merged,
        fast_confirm_ready: isReadyForFastConfirm(merged),
      };
    });

    const filteredRows = onlyFastConfirm
      ? enrichedRows.filter((row) => row.fast_confirm_ready)
      : enrichedRows;

    const sortedRows = [...filteredRows].sort(compareRowsForReview);

    return json(200, {
      ok: true,
      rows: sortedRows,
      meta: {
        total: sortedRows.length,
        fastConfirmReady: sortedRows.filter((row) => row.fast_confirm_ready).length,
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Items lookup failed." });
  }
}