import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/tester-access/activate — Path α (post-rebuild onboarding)
//
// Reads tester entitlement from chiefos_beta_signups (status='approved' +
// entitlement_plan ∈ {'starter','pro','enterprise'}) and writes the canonical
// plan to public.users.plan_key keyed by auth_user_id.
//
// Drift removed (vs. pre-rebuild):
//   - user_auth_links lookup → chiefos_portal_users + users.auth_user_id
//   - users.subscription_tier / users.paid_tier writes → users.plan_key
//
// Called by FinishSignupClient after chiefos_finish_signup() RPC has created
// the public.users row, so the UPDATE always finds a target. If the beta
// signup row isn't approved yet, returns 200 with plan='free' so the FE
// continues without surfacing an error (admin approval can happen later).
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PLANS = new Set(["starter", "pro", "enterprise"]);

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function adminClient() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const accessToken = bearerFromReq(req);
    if (!accessToken) return json(401, { ok: false, error: "Missing session." });

    const admin = adminClient();
    const { data: authData, error: authErr } = await admin.auth.getUser(accessToken);
    if (authErr || !authData?.user?.id) {
      return json(401, { ok: false, error: "Invalid session." });
    }

    const authUserId = authData.user.id;
    const email = String(authData.user.email || "").toLowerCase();
    if (!email) return json(400, { ok: false, error: "Missing email on auth user." });

    // Look up beta-signup entitlement by email (case-insensitive).
    const { data: beta, error: betaErr } = await admin
      .from("chiefos_beta_signups")
      .select("status, entitlement_plan")
      .ilike("email", email)
      .maybeSingle();

    if (betaErr) {
      return json(500, { ok: false, error: betaErr.message || "Failed to read beta signup." });
    }

    const isApproved = beta?.status === "approved";
    const entitlement = String(beta?.entitlement_plan || "").toLowerCase();

    if (!isApproved || !VALID_PLANS.has(entitlement)) {
      // Not yet approved (or no entitlement set). Don't error — let the FE
      // continue with the free-tier default; admin can approve later.
      return json(200, { ok: true, plan: "free", reason: "not_yet_approved" });
    }

    // Write canonical plan to public.users via the auth_user_id reverse pointer.
    const { data: updated, error: updErr } = await admin
      .from("users")
      .update({ plan_key: entitlement })
      .eq("auth_user_id", authUserId)
      .select("plan_key")
      .maybeSingle();

    if (updErr) {
      return json(500, { ok: false, error: updErr.message || "Failed to write plan_key." });
    }
    if (!updated) {
      return json(404, { ok: false, error: "No public.users row for auth user — RPC must run first." });
    }

    return json(200, { ok: true, plan: updated.plan_key });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "tester activation error." });
  }
}
