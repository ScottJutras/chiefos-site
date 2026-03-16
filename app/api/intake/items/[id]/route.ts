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

  const tenantId = String(pu.tenant_id);
  const role = String(pu.role || "");

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr || !tenant?.owner_id) {
    return { ok: false as const, error: tenantErr?.message || "Missing owner context." };
  }

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId,
    ownerId: String(tenant.owner_id),
    role,
  };
}

function uniqueJobSuggestions(rows: Array<{ id: number; job_name: string; status?: string | null }>) {
  const seen = new Set<string>();
  const out: Array<{ id: number; job_name: string; status?: string | null }> = [];

  for (const row of rows) {
    const key = String(row.job_name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
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

function isFastConfirmReady(input: { item: any; draft: any }) {
  const item = input.item || {};
  const draft = input.draft || {};
  const status = String(item.status || "").trim();
  const confidence = Number(item.confidence_score || 0);
  const amount = Number(draft.amount_cents || 0);
  const vendor = String(draft.vendor || "").trim();
  const eventDate = String(draft.event_date || "").trim();
  const jobName = String(draft.job_name || item.job_name || "").trim();
  const flags = normalizeFlags(draft.validation_flags);

  if (status !== "pending_review") return false;
  if (confidence < 0.85) return false;
  if (!amount || amount <= 0) return false;
  if (!vendor) return false;
  if (!eventDate) return false;
  if (!jobName) return false;
  if (hasBlockingFlags(flags)) return false;

  return true;
}

function escapeLikeQuery(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

function buildBestText(item: any, draft: any) {
  return (
    String(item?.ocr_text || "").trim() ||
    String(item?.transcript_text || "").trim() ||
    String(draft?.raw_model_output?.extract?.text_preview || "").trim() ||
    null
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;

    console.info("[INTAKE_ITEM_DETAIL_ROUTE_HIT]", {
      url: req.url,
      itemIdFromParams: params?.id || null,
    });

    const ctx = await getPortalContext(req);
    if (!ctx.ok) {
      console.warn("[INTAKE_ITEM_DETAIL_UNAUTHORIZED]", {
        url: req.url,
        error: ctx.error,
      });
      return json(401, { ok: false, error: ctx.error });
    }

    const admin = ctx.admin;
    const itemId = String(params?.id || "").trim();

    if (!itemId) {
      console.warn("[INTAKE_ITEM_DETAIL_BAD_REQUEST]", {
        url: req.url,
        tenantId: ctx.tenantId,
        error: "Missing item id.",
      });
      return json(400, { ok: false, error: "Missing item id." });
    }

    const { data: itemAnyTenant, error: itemAnyTenantErr } = await admin
      .from("intake_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (itemAnyTenantErr) {
      console.error("[INTAKE_ITEM_DETAIL_LOOKUP_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        error: itemAnyTenantErr.message || "Failed to look up intake item.",
      });
      return json(500, {
        ok: false,
        error: itemAnyTenantErr.message || "Failed to look up intake item.",
      });
    }

    if (!itemAnyTenant) {
      console.warn("[INTAKE_ITEM_DETAIL_NOT_FOUND]", {
        itemId,
        tenantId: ctx.tenantId,
      });

      return json(404, {
        ok: false,
        error: "Intake item not found.",
        code: "ITEM_NOT_FOUND",
        itemId,
      });
    }

    if (String(itemAnyTenant.tenant_id || "") !== ctx.tenantId) {
      console.warn("[INTAKE_ITEM_DETAIL_TENANT_MISMATCH]", {
        itemId,
        tenantId: ctx.tenantId,
        itemTenantId: String(itemAnyTenant.tenant_id || ""),
      });

      return json(403, {
        ok: false,
        error: "Item exists but does not belong to this tenant context.",
        code: "TENANT_MISMATCH",
        itemId,
        tenantId: ctx.tenantId,
        itemTenantId: String(itemAnyTenant.tenant_id || ""),
      });
    }

    const item = itemAnyTenant;

    const { data: draft, error: draftErr } = await admin
      .from("intake_item_drafts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId)
      .limit(1)
      .maybeSingle();

    if (draftErr) {
      console.error("[INTAKE_ITEM_DETAIL_DRAFT_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        error: draftErr.message || "Failed to load draft.",
      });
      return json(500, { ok: false, error: draftErr.message || "Failed to load draft." });
    }

    const { data: reviews, error: reviewsErr } = await admin
      .from("intake_item_reviews")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId)
      .order("created_at", { ascending: false });

    if (reviewsErr) {
      console.error("[INTAKE_ITEM_DETAIL_REVIEWS_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        error: reviewsErr.message || "Failed to load reviews.",
      });
      return json(500, { ok: false, error: reviewsErr.message || "Failed to load reviews." });
    }

    const { data: batchItems, error: batchItemsErr } = await admin
      .from("intake_items")
      .select("id, status, created_at, source_filename, kind, confidence_score, job_name")
      .eq("tenant_id", ctx.tenantId)
      .eq("batch_id", item.batch_id)
      .order("created_at", { ascending: true });

    if (batchItemsErr) {
      console.error("[INTAKE_ITEM_DETAIL_BATCH_ERR]", {
        itemId,
        tenantId: ctx.tenantId,
        batchId: item.batch_id || null,
        error: batchItemsErr.message || "Failed to load batch items.",
      });
      return json(500, { ok: false, error: batchItemsErr.message || "Failed to load batch items." });
    }

    const rows = batchItems || [];
    const pendingStatuses = new Set(["pending_review", "uploaded", "validated", "extracted", "normalized"]);
    const currentIdx = rows.findIndex((r: any) => String(r.id) === itemId);

    let prevItemId: string | null = null;
    let nextItemId: string | null = null;

    if (currentIdx > 0) prevItemId = String(rows[currentIdx - 1]?.id || "") || null;
    if (currentIdx > -1 && currentIdx < rows.length - 1) {
      nextItemId = String(rows[currentIdx + 1]?.id || "") || null;
    }

    const nextPending = rows.find(
      (r: any) => pendingStatuses.has(String(r.status || "")) && String(r.id) !== itemId
    );

    const batchProgress = {
      total: rows.length,
      pending: rows.filter((r: any) => String(r.status) === "pending_review").length,
      persisted: rows.filter((r: any) => String(r.status) === "persisted").length,
      skipped: rows.filter((r: any) => String(r.status) === "skipped").length,
      duplicate: rows.filter((r: any) => String(r.status) === "duplicate").length,
      failed: rows.filter((r: any) => String(r.status) === "failed").length,
      currentIndex: currentIdx >= 0 ? currentIdx + 1 : 1,
    };

    const jobSuggestions: Array<{ id: number; job_name: string; status?: string | null }> = [];
    const parseJobTerms: string[] = Array.isArray(draft?.raw_model_output?.enrich?.suggested_job_terms)
      ? (draft.raw_model_output.enrich.suggested_job_terms as string[])
      : [];

    const draftJobName = String(draft?.job_name || item?.job_name || "").trim();
    const jobSearchTerms = [draftJobName, ...parseJobTerms]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .slice(0, 4);

    for (const rawTerm of jobSearchTerms) {
      const term = escapeLikeQuery(rawTerm);
      const token = `%${term}%`;

      const { data: fuzzyJobs, error: fuzzyJobsErr } = await admin
        .from("jobs")
        .select("id, job_name, name, status")
        .eq("owner_id", ctx.ownerId)
        .or(`job_name.ilike.${token},name.ilike.${token}`)
        .limit(8);

      if (fuzzyJobsErr) {
        console.error("[INTAKE_ITEM_DETAIL_JOB_SUGGEST_ERR]", {
          itemId,
          ownerId: ctx.ownerId,
          term: rawTerm,
          error: fuzzyJobsErr.message || "Failed to load job suggestions.",
        });
        return json(500, {
          ok: false,
          error: fuzzyJobsErr.message || "Failed to load job suggestions.",
        });
      }

      for (const row of fuzzyJobs || []) {
        jobSuggestions.push({
          id: Number((row as any).id),
          job_name: String((row as any).job_name || (row as any).name || ""),
          status: (row as any).status ?? null,
        });
      }
    }

    if (jobSuggestions.length === 0) {
      const { data: recentJobs, error: recentJobsErr } = await admin
        .from("jobs")
        .select("id, job_name, name, status, created_at")
        .eq("owner_id", ctx.ownerId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (recentJobsErr) {
        console.error("[INTAKE_ITEM_DETAIL_RECENT_JOBS_ERR]", {
          itemId,
          ownerId: ctx.ownerId,
          error: recentJobsErr.message || "Failed to load recent jobs.",
        });
        return json(500, {
          ok: false,
          error: recentJobsErr.message || "Failed to load recent jobs.",
        });
      }

      for (const row of recentJobs || []) {
        jobSuggestions.push({
          id: Number((row as any).id),
          job_name: String((row as any).job_name || (row as any).name || ""),
          status: (row as any).status ?? null,
        });
      }
    }

    const validationFlags = normalizeFlags(draft?.validation_flags);
    const fastConfirmReady = isFastConfirmReady({ item, draft });
    const bestText = buildBestText(item, draft);

    console.info("[INTAKE_ITEM_DETAIL_OK]", {
      itemId,
      tenantId: ctx.tenantId,
      batchId: item.batch_id || null,
      hasDraft: !!draft,
      reviewCount: Array.isArray(reviews) ? reviews.length : 0,
      batchCount: rows.length,
    });

    return json(200, {
      ok: true,
      item,
      draft: draft || null,
      reviews: reviews || [],
      batchProgress,
      nav: {
        prevItemId,
        nextItemId,
        nextPendingItemId: nextPending ? String((nextPending as any).id) : null,
      },
      jobSuggestions: uniqueJobSuggestions(jobSuggestions).slice(0, 8),
      evidence: {
        storage_bucket: item.storage_bucket,
        storage_path: item.storage_path,
        source_filename: item.source_filename || null,
        mime_type: item.mime_type || null,
        kind: item.kind,
      },
      extractedText: {
        ocr_text: item.ocr_text || null,
        transcript_text: item.transcript_text || null,
        best_text: bestText,
      },
      parse: draft?.raw_model_output || null,
      reviewState: {
        validationFlags,
        fastConfirmReady,
        hasBlockingFlags: hasBlockingFlags(validationFlags),
        readyReason: fastConfirmReady
          ? "This draft has amount, vendor, date, job, and no blocking flags."
          : !String(draft?.job_name || item?.job_name || "").trim()
          ? "Job is still required before fast confirm is allowed."
          : hasBlockingFlags(validationFlags)
          ? "This draft still has blocking review flags."
          : "This draft still needs owner review before confirm.",
      },
    });
  } catch (e: any) {
    console.error("[INTAKE_ITEM_DETAIL_FATAL]", {
      message: e?.message || "Item detail lookup failed.",
    });
    return json(500, { ok: false, error: e?.message || "Item detail lookup failed." });
  }
}