// app/api/whoami/route.ts
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function missingEnv(names: string[]) {
  return names.filter((n) => !process.env[n]);
}

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function jsonErr(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function getSupabaseUser(accessToken: string): Promise<{ id: string; email: string | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const j = await r.json().catch(() => null);
  const id = j?.id ? String(j.id) : null;
  const email = j?.email ? String(j.email).trim().toLowerCase() : null;

  if (!id) return null;
  return { id, email: email || null };
}

/**
 * Uses the user's JWT and relies on RLS.
 * - chiefos_portal_users select own
 * - chiefos_user_identities select own
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
    const tid = (rows as any[])?.[0]?.tenant_id;
    if (tid) return String(tid);
  }

  // 2) Fallback: identity mapping (still RLS-safe if policy is select own)
  const r2 = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=tenant_id&user_id=eq.${userId}&order=created_at.asc&limit=1`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!r2.ok) return null;
  const rows2 = await r2.json().catch(() => []);
  const tid2 = (rows2 as any[])?.[0]?.tenant_id ?? null;
  return tid2 ? String(tid2) : null;
}

/**
 * User-scoped WhatsApp identity check (works with "select own" RLS)
 */
async function hasWhatsAppIdentityForUser(userId: string, accessToken: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const r = await fetch(
    `${url}/rest/v1/chiefos_user_identities?select=id&user_id=eq.${userId}&kind=in.(whatsapp,wa,WhatsApp)&limit=1`,
    {
      headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

type BetaStatus = "requested" | "approved" | "denied";
type BetaPlan = "free" | "starter" | "pro";

function normalizeBetaPlan(v: any): BetaPlan | null {
  const s = String(v || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

async function getBetaRowByEmail(email: string): Promise<{
  status: BetaStatus | null;
  entitlementPlan: BetaPlan | null;
  approvedPlan: BetaPlan | null; // only when status=approved
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Don't crash whoami if service role is missing; omit beta info.
  if (!service) {
  return {
    status: null,
    entitlementPlan: null,
    approvedPlan: null,
    // @ts-ignore
    _debug: { serviceMissing: true },
  } as any;
}

  const q = new URLSearchParams();
  q.set("select", "status,entitlement_plan,plan,approved_at,created_at");
  // ✅ Correct quoted PostgREST filter
  q.set("email", `eq."${email}"`);
  // ✅ Prefer latest row if duplicates exist
  q.set("order", "created_at.desc");
  q.set("limit", "1");

  const r = await fetch(`${url}/rest/v1/chiefos_beta_signups?${q.toString()}`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
    cache: "no-store",
  });

  if (!service) {
  return {
    status: null,
    entitlementPlan: null,
    approvedPlan: null,
    // @ts-ignore
    _debug: { serviceMissing: true },
  } as any;
}

  const rows = (await r.json().catch(() => [])) as any[];
  // @ts-ignore
const _debug = { rows: Array.isArray(rows) ? rows.length : -1 };
  const row = rows?.[0];
  if (!row) return null;

  const rawStatus = String(row.status || "").trim().toLowerCase();
  const status: BetaStatus | null =
    rawStatus === "requested" || rawStatus === "approved" || rawStatus === "denied"
      ? (rawStatus as BetaStatus)
      : null;

  const entitlementPlan = normalizeBetaPlan(row.entitlement_plan || row.plan);
  const approvedPlan = status === "approved" ? entitlementPlan : null;

  return { status, entitlementPlan, approvedPlan, _debug } as any;
}

export async function GET(req: NextRequest) {
  const miss = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (miss.length) {
    return jsonErr("CONFIG_ERROR", `Missing env vars: ${miss.join(", ")}`, 500);
  }

  try {
    const accessToken = getBearer(req);
    if (!accessToken) return jsonErr("AUTH_REQUIRED", "Missing auth token.", 401);

    const user = await getSupabaseUser(accessToken);
    if (!user?.id) return jsonErr("AUTH_REQUIRED", "Invalid session.", 401);

    const userId = user.id;
    const email = user.email;

    const tenantId = await firstTenantForUser(userId, accessToken);
    const safeTenantId = tenantId ? String(tenantId) : null;

    const hasWhatsApp = await hasWhatsAppIdentityForUser(userId, accessToken);

    const beta = email ? await getBetaRowByEmail(email) : null;

    return NextResponse.json(
      {
        ok: true,
        userId,
        tenantId: safeTenantId,
        hasWhatsApp,
        email: email || null,
        betaPlan: beta?.approvedPlan || null, // only when approved
        betaStatus: beta?.status || null, // requested|approved|denied|null
        betaEntitlementPlan: beta?.entitlementPlan || null, // requested/entitled plan
        debug: {
  supabaseUrlHost: (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host; } catch { return null; }
  })(),
  hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  betaDebug: (beta as any)?._debug || null,
},
      },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonErr("WHOAMI_ERROR", e?.message || "whoami failed", 500);
  }
}