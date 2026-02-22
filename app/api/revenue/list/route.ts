import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function missingEnv(names: string[]) {
  return names.filter((n) => !process.env[n]);
}

function bearerFromReq(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const s = String(h);
  return s.toLowerCase().startsWith("bearer ") ? s.slice(7).trim() : "";
}

async function getSupabaseUserId(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.id ?? null;
}

async function firstTenantForUser(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const r1 = await fetch(
    `${url}/rest/v1/chiefos_portal_users?select=tenant_id&user_id=eq.${userId}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );

  if (r1.ok) {
    const rows = await r1.json().catch(() => []);
    const tid = rows?.[0]?.tenant_id;
    if (tid) return String(tid);
  }

  const r2 = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=tenant_id&user_id=eq.${userId}&order=created_at.asc&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );

  if (!r2.ok) return null;
  const rows2 = await r2.json().catch(() => []);
  const tid2 = rows2?.[0]?.tenant_id ?? null;
  return tid2 ? String(tid2) : null;
}

async function tenantToOwnerId(tenantId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(
    `${url}/rest/v1/chiefos_tenants?select=owner_id&id=eq.${tenantId}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  const ownerId = rows?.[0]?.owner_id ?? null;
  return ownerId ? String(ownerId) : null;
}

export async function GET(req: Request) {
  // ✅ explicit config check so errors are truthful
  const miss = missingEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  if (miss.length) {
    return NextResponse.json(
      { ok: false, code: "CONFIG_ERROR", message: `Missing env vars: ${miss.join(", ")}` },
      { status: 500 }
    );
  }

  try {
    const accessToken = bearerFromReq(req);
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Missing auth token." }, { status: 401 });
    }

    const userId = await getSupabaseUserId(accessToken);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Invalid session." }, { status: 401 });
    }

    const tenantId = await firstTenantForUser(userId);
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "No tenant for this user." }, { status: 403 });
    }

    const ownerId = await tenantToOwnerId(tenantId);
    if (!ownerId) {
      return NextResponse.json(
        { ok: false, error: "Tenant is not linked to an owner_id yet (chiefos_tenants)." },
        { status: 500 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const r = await fetch(
      `${url}/rest/v1/transactions?select=id,date,amount,amount_cents,source,description,job,job_name,created_at,kind,category&owner_id=eq.${encodeURIComponent(
        ownerId
      )}&kind=eq.revenue&order=date.desc,created_at.desc&limit=200`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
    );

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Supabase read failed (${r.status}): ${t || "no body"}` },
        { status: 502 }
      );
    }

    const rows = await r.json().catch(() => []);
    return NextResponse.json({ ok: true, tenantId, rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error." }, { status: 500 });
  }
}