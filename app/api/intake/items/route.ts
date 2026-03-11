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

  return {
    ok: true as const,
    admin,
    tenantId: String(pu.tenant_id),
    role: String(pu.role || ""),
  };
}

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "").trim();
    const kind = String(url.searchParams.get("kind") || "").trim();
    const batchId = String(url.searchParams.get("batchId") || "").trim();
    const q = String(url.searchParams.get("q") || "").trim();
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    let query = ctx.admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (kind) query = query.eq("kind", kind);
    if (batchId) query = query.eq("batch_id", batchId);

    if (q) {
      query = query.or(
        `source_filename.ilike.%${q}%,job_name.ilike.%${q}%,ocr_text.ilike.%${q}%,transcript_text.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return json(500, { ok: false, error: error.message || "Failed to load intake items." });
    }

    return json(200, { ok: true, rows: data || [] });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Items lookup failed." });
  }
}