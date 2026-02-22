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

async function firstTenantForUser(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 1) Portal membership (if exists)
  const r1 = await fetch(
    `${url}/rest/v1/chiefos_portal_users?select=tenant_id,role&user_id=eq.${userId}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  );
  if (r1.ok) {
    const rows = await r1.json().catch(() => []);
    const tid = rows?.[0]?.tenant_id;
    if (tid) return String(tid);
  }

  // 2) Fallback: identity table (your SQL shows this exists)
  const r2 = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=tenant_id&user_id=eq.${userId}&order=created_at.asc&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  );
  if (!r2.ok) return null;

  const rows2 = await r2.json().catch(() => []);
  const tid2 = rows2?.[0]?.tenant_id ?? null;
  return tid2 ? String(tid2) : null;
}

async function hasWhatsAppIdentity(tenantId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=id&tenant_id=eq.${tenantId}&kind=eq.whatsapp&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } }
  );
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const userId = await getSupabaseUserId(accessToken);
    if (!userId) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const tenantId = await firstTenantForUser(userId);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found for this user." }, { status: 403 });
    }

    const hasWhatsApp = await hasWhatsAppIdentity(tenantId);

    return NextResponse.json({ ok: true, userId, tenantId, hasWhatsApp });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error." }, { status: 500 });
  }
}