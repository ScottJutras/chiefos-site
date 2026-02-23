// app/api/whoami/route.ts
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BetaPlan = "free" | "starter" | "pro";
type BetaStatus = "requested" | "approved" | "denied";

function missingEnv(names: string[]) {
  return names.filter((n) => !process.env[n]);
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function jsonErr(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

async function getSupabaseUser(accessToken: string): Promise<{ id: string | null; email: string | null }> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!r.ok) return { id: null, email: null };
  const j = await r.json().catch(() => null);

  const id = j?.id ? String(j.id) : null;
  const email = j?.email ? String(j.email).trim().toLowerCase() : null;

  return { id, email };
}

/**
 * Uses user JWT + RLS.
 * Policies assumed:
 * - chiefos_portal_users_select_own
 * - chiefos_user_identities_select_own
 */
async function firstTenantForUser(userId: string, accessToken: string): Promise<string | null> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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

  // 2) Fallback: identity mapping
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

async function hasWhatsAppIdentityForUser(userId: string, accessToken: string): Promise<boolean> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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

async function getBetaRowByEmail(email: string): Promise<{
  status: BetaStatus | null;
  entitlementPlan: BetaPlan | null;
  approvedPlan: BetaPlan | null; // only if status=approved
} | null> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const service = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const q = new URLSearchParams();
  q.set("select", "status,entitlement_plan,plan,approved_at");
  q.set("email", `eq.${email}`);
  q.set("limit", "1");

  const r = await fetch(`${url}/rest/v1/chiefos_beta_signups?${q.toString()}`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const rows = (await r.json().catch(() => [])) as any[];
  const row = rows?.[0];
  if (!row) return null;

  const statusRaw = String(row.status || "").toLowerCase();
  const status: BetaStatus | null =
    statusRaw === "requested" || statusRaw === "approved" || statusRaw === "denied"
      ? (statusRaw as BetaStatus)
      : null;

  const planRaw = String(row.entitlement_plan || row.plan || "").toLowerCase();
  const entitlementPlan: BetaPlan | null =
    planRaw === "free" || planRaw === "starter" || planRaw === "pro" ? (planRaw as BetaPlan) : null;

  const approvedPlan = status === "approved" ? entitlementPlan : null;

  return { status, entitlementPlan, approvedPlan };
}

export async function GET(req: NextRequest) {
  const miss = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (miss.length) return jsonErr("CONFIG_ERROR", `Missing env vars: ${miss.join(", ")}`, 500);

  try {
    const accessToken = getBearer(req);
    if (!accessToken) return jsonErr("AUTH_REQUIRED", "Missing auth token.", 401);

    const { id: userId, email } = await getSupabaseUser(accessToken);
    if (!userId) return jsonErr("AUTH_REQUIRED", "Invalid session.", 401);

    const tenantId = await firstTenantForUser(userId, accessToken);
    if (!tenantId) return jsonErr("NO_TENANT", "No tenant found for this user.", 403);

    const hasWhatsApp = await hasWhatsAppIdentityForUser(userId, accessToken);

    const beta = email ? await getBetaRowByEmail(email) : null;

    return NextResponse.json(
      {
        ok: true,
        userId,
        tenantId,
        hasWhatsApp,

        email: email || null,

        // ✅ if approved, this is the effective beta entitlement
        betaPlan: beta?.approvedPlan || null,

        // ✅ useful for UI: show waitlist state
        betaStatus: beta?.status || null,

        // ✅ what they requested / what you’ll approve them into
        betaEntitlementPlan: beta?.entitlementPlan || null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return jsonErr("WHOAMI_ERROR", e?.message || "whoami failed", 500);
  }
}