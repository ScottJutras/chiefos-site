// app/api/whoami/route.ts
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs"; // ✅ force Node (not Edge)

function missingEnv(names: string[]) {
  return names.filter((n) => !process.env[n]);
}

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

async function getSupabaseUserId(accessToken: string): Promise<string | null> {
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

async function firstTenantForUser(userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // 1) Portal membership (preferred)
  const r1 = await fetch(
    `${url}/rest/v1/chiefos_portal_users?select=tenant_id,role&user_id=eq.${userId}&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );

  if (r1.ok) {
    const rows = await r1.json().catch(() => []);
    const tid = rows?.[0]?.tenant_id;
    if (tid) return String(tid);
  }

  // 2) Fallback: identity mapping
  const r2 = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=tenant_id&user_id=eq.${userId}&order=created_at.asc&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );

  if (!r2.ok) return null;
  const rows2 = await r2.json().catch(() => []);
  const tid2 = rows2?.[0]?.tenant_id ?? null;
  return tid2 ? String(tid2) : null;
}

async function hasWhatsAppIdentity(tenantId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const r = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=id&tenant_id=eq.${tenantId}&kind=eq.whatsapp&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` }, cache: "no-store" }
  );

  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET(req: NextRequest) {
  // ✅ hard-check config but don’t throw
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
    const accessToken = getBearer(req);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", message: "Missing auth token." },
        { status: 401 }
      );
    }

    const userId = await getSupabaseUserId(accessToken);
    if (!userId) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", message: "Invalid session." },
        { status: 401 }
      );
    }

    const tenantId = await firstTenantForUser(userId);
    if (!tenantId) {
      return NextResponse.json(
        { ok: false, code: "NO_TENANT", message: "No tenant found for this user." },
        { status: 403 }
      );
    }

    const hasWhatsApp = await hasWhatsAppIdentity(tenantId);

    return NextResponse.json({ ok: true, userId, tenantId, hasWhatsApp }, { status: 200 });
  } catch (e: any) {
    // ✅ return the error message so we can fix it fast
    return NextResponse.json(
      { ok: false, code: "WHOAMI_ERROR", message: e?.message || "whoami failed" },
      { status: 500 }
    );
  }
}