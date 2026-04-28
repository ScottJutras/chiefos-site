import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/auth/pending-signup — Path α (post-rebuild onboarding)
//
// GET   reads onboarding state from auth.users.raw_user_meta_data and shapes
//       it into the PendingSignup TypeScript shape FE expects. The DISCARDed
//       chiefos_pending_signups table is replaced entirely by metadata.
//
// POST { action: "set-tenant-meta" }
//       NO-OP STUB. RPC chiefos_finish_signup() now writes country/province
//       directly to chiefos_tenants. The FE call to set-tenant-meta is being
//       removed in this same PR; the stub stays so an FE/server timing skew
//       during deploy doesn't 5xx. Follow-up tiny PR will delete the stub
//       once the new FE has soaked.
//
// POST { action: "consume" }
//       NO-OP idempotent confirmation. RPC inserts users.signup_status=
//       'complete' atomically, so there's nothing to flip server-side. The
//       endpoint stays for FE compatibility — it can be removed when FE is
//       touched for unrelated reasons.
//       TODO(post-soak): remove `consume` action once FinishSignupClient
//       drops the trailing call.
// ─────────────────────────────────────────────────────────────────────────────

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

function metaStr(meta: any, key: string): string | null {
  const v = meta?.[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function GET(req: Request) {
  try {
    const accessToken = bearerFromReq(req);
    if (!accessToken) return json(401, { ok: false, error: "Missing session." });

    const admin = adminClient();
    const { data: authData, error: authErr } = await admin.auth.getUser(accessToken);
    if (authErr || !authData?.user?.id) {
      return json(401, { ok: false, error: "Invalid session." });
    }

    const user = authData.user;
    const meta = (user.user_metadata || {}) as Record<string, any>;

    // Shape into the PendingSignup TS type FinishSignupClient expects.
    // `id` historically pointed to a chiefos_pending_signups row uuid; now
    // we surface the auth user id since FE doesn't act on the field beyond
    // type-shape compatibility.
    const pendingSignup = {
      id: user.id,
      email: user.email || "",
      owner_name: metaStr(meta, "owner_name"),
      owner_phone: metaStr(meta, "owner_phone"),
      company_name: metaStr(meta, "company_name"),
      country: metaStr(meta, "country"),
      province: metaStr(meta, "province"),
      signup_mode: metaStr(meta, "signup_mode"),
      requested_plan_key: metaStr(meta, "requested_plan_key"),
      terms_accepted_at: metaStr(meta, "terms_accepted_at"),
      terms_version: metaStr(meta, "terms_version"),
      privacy_accepted_at: metaStr(meta, "privacy_accepted_at"),
      privacy_version: metaStr(meta, "privacy_version"),
      ai_policy_accepted_at: metaStr(meta, "ai_policy_accepted_at"),
      ai_policy_version: metaStr(meta, "ai_policy_version"),
      dpa_acknowledged_at: metaStr(meta, "dpa_acknowledged_at"),
      dpa_version: metaStr(meta, "dpa_version"),
      accepted_via: metaStr(meta, "accepted_via"),
    };

    return json(200, { ok: true, pendingSignup });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "pending-signup GET error." });
  }
}

export async function POST(req: Request) {
  try {
    const accessToken = bearerFromReq(req);
    if (!accessToken) return json(401, { ok: false, error: "Missing session." });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "set-tenant-meta") {
      // No-op stub. See header.
      return json(200, { ok: true, noop: true });
    }

    if (action === "consume") {
      // No-op idempotent confirmation. See header.
      return json(200, { ok: true, noop: true });
    }

    return json(400, { ok: false, error: `Unknown action: ${action || "(missing)"}` });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "pending-signup POST error." });
  }
}
