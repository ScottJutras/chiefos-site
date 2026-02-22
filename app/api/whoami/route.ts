// app/api/whoami/route.ts
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function missingEnv(names: string[]) {
  return names.filter((n) => !process.env[n]);
}

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function jsonErr(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
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

/**
 * IMPORTANT:
 * This uses the *user's* JWT and relies on RLS.
 * Your existing policies:
 * - portal_users_select_own
 * - user_identities_select_own
 * make these reads safe and tenant-scoped.
 */
async function firstTenantForUser(userId: string, accessToken: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // 1) Portal membership (preferred)
  const r1 = await fetch(
    `${url}/rest/v1/chiefos_portal_users?select=tenant_id,role&user_id=eq.${userId}&limit=1`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (r1.ok) {
    const rows = await r1.json().catch(() => []);
    const tid = rows?.[0]?.tenant_id;
    if (tid) return String(tid);
  }

  // 2) Fallback: identity mapping (still RLS-safe if policy is "select own")
  const r2 = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=tenant_id&user_id=eq.${userId}&order=created_at.asc&limit=1`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!r2.ok) return null;
  const rows2 = await r2.json().catch(() => []);
  const tid2 = rows2?.[0]?.tenant_id ?? null;
  return tid2 ? String(tid2) : null;
}

/**
 * Check WhatsApp identity for *this user* (not by tenant),
 * so it works with your "select_own" RLS policy.
 */
async function hasWhatsAppIdentityForUser(userId: string, accessToken: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const r = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=id&user_id=eq.${userId}&kind=eq.whatsapp&limit=1`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function GET(req: NextRequest) {
  // ✅ Only require public supabase envs (server can read them; client also has them)
  const miss = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (miss.length) {
    return jsonErr("CONFIG_ERROR", `Missing env vars: ${miss.join(", ")}`, 500);
  }

  try {
    const accessToken = getBearer(req);
    if (!accessToken) return jsonErr("AUTH_REQUIRED", "Missing auth token.", 401);

    const userId = await getSupabaseUserId(accessToken);
    if (!userId) return jsonErr("AUTH_REQUIRED", "Invalid session.", 401);

    const tenantId = await firstTenantForUser(userId, accessToken);
    if (!tenantId) return jsonErr("NO_TENANT", "No tenant found for this user.", 403);

    const hasWhatsApp = await hasWhatsAppIdentityForUser(userId, accessToken);

    return NextResponse.json({ ok: true, userId, tenantId, hasWhatsApp }, { status: 200 });
  } catch (e: any) {
    return jsonErr("WHOAMI_ERROR", e?.message || "whoami failed", 500);
  }
}