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

  const tenantId = String(pu.tenant_id);
  const role = String(pu.role || "");

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", tenantId)
    .single();

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

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    const params = await context.params;
    const itemId = String(params.id || "").trim();
    if (!itemId) return json(400, { ok: false, error: "Missing item id." });

    const { data: item, error: itemErr } = await ctx.admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId)
      .single();

    if (itemErr || !item) {
      return json(404, { ok: false, error: itemErr?.message || "Intake item not found." });
    }

    const { data: draft, error: draftErr } = await ctx.admin
      .from("intake_item_drafts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId)
      .limit(1)
      .maybeSingle();

    if (draftErr) {
      return json(500, { ok: false, error: draftErr.message || "Failed to load draft." });
    }

    const { data: reviews, error: reviewsErr } = await ctx.admin
      .from("intake_item_reviews")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId)
      .order("created_at", { ascending: false });

    if (reviewsErr) {
      return json(500, { ok: false, error: reviewsErr.message || "Failed to load reviews." });
    }

    const { data: batchItems, error: batchItemsErr } = await ctx.admin
      .from("intake_items")
      .select("id, status, created_at, source_filename, kind")
      .eq("tenant_id", ctx.tenantId)
      .eq("batch_id", item.batch_id)
      .order("created_at", { ascending: true });

    if (batchItemsErr) {
      return json(500, { ok: false, error: batchItemsErr.message || "Failed to load batch items." });
    }

    const rows = batchItems || [];
    const pendingStatuses = new Set(["pending_review", "uploaded", "validated", "extracted"]);
    const currentIdx = rows.findIndex((r: any) => String(r.id) === itemId);

    let prevItemId: string | null = null;
    let nextItemId: string | null = null;

    if (currentIdx > 0) prevItemId = String(rows[currentIdx - 1]?.id || "") || null;
    if (currentIdx > -1 && currentIdx < rows.length - 1) {
      nextItemId = String(rows[currentIdx + 1]?.id || "") || null;
    }

    const nextPending = rows.find((r: any) => pendingStatuses.has(String(r.status || "")) && String(r.id) !== itemId);

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
    const draftJobName = String(draft?.job_name || item?.job_name || "").trim();

    if (draftJobName) {
      const { data: fuzzyJobs } = await ctx.admin
        .from("jobs")
        .select("id, job_name, status")
        .eq("owner_id", ctx.ownerId)
        .or(`job_name.ilike.%${draftJobName}%,name.ilike.%${draftJobName}%`)
        .limit(8);

      for (const row of fuzzyJobs || []) {
        jobSuggestions.push({
          id: Number((row as any).id),
          job_name: String((row as any).job_name || (row as any).name || ""),
          status: (row as any).status ?? null,
        });
      }
    }

    if (jobSuggestions.length === 0) {
      const { data: recentJobs } = await ctx.admin
        .from("jobs")
        .select("id, job_name, status, created_at")
        .eq("owner_id", ctx.ownerId)
        .order("created_at", { ascending: false })
        .limit(8);

      for (const row of recentJobs || []) {
        jobSuggestions.push({
          id: Number((row as any).id),
          job_name: String((row as any).job_name || (row as any).name || ""),
          status: (row as any).status ?? null,
        });
      }
    }

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
      jobSuggestions,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Item detail lookup failed." });
  }
}