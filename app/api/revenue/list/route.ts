import { NextResponse } from "next/server";

async function getSupabaseUserId(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.id ?? null;
}

async function isMemberOfTenant(userId: string, tenantId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(
    `${url}/rest/v1/chiefos_portal_users?select=user_id,tenant_id,role&user_id=eq.${userId}&tenant_id=eq.${tenantId}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  );
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function tenantToOwnerId(tenantId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(
    `${url}/rest/v1/chiefos_tenants?select=owner_id&id=eq.${tenantId}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  const ownerId = rows?.[0]?.owner_id ?? null;
  return ownerId ? String(ownerId) : null;
}


export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!accessToken) return NextResponse.json({ error: "Missing auth token." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = String(searchParams.get("tenantId") || "").trim();
    if (!tenantId) return NextResponse.json({ error: "Missing tenantId." }, { status: 400 });

    const userId = await getSupabaseUserId(accessToken);
    if (!userId) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const ok = await isMemberOfTenant(userId, tenantId);
    if (!ok) return NextResponse.json({ error: "Not allowed for this tenant." }, { status: 403 });

    const ownerId = await tenantToOwnerId(tenantId);
    if (!ownerId) {
      return NextResponse.json(
        { error: "Tenant is not linked to an owner_id yet (chiefos_tenants)." },
        { status: 500 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const r = await fetch(
      `${url}/rest/v1/transactions?select=id,date,amount,amount_cents,source,description,job,job_name,created_at,kind,category&owner_id=eq.${encodeURIComponent(
        ownerId
      )}&kind=eq.revenue&order=date.desc,created_at.desc&limit=200`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` } }
    );

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Supabase read failed: ${t}`);
    }

    const rows = await r.json();
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error." }, { status: 500 });
  }
}
