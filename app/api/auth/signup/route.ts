import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/auth/signup — Path α (post-rebuild onboarding)
//
// Stores all onboarding metadata on auth.users.raw_user_meta_data via the
// Supabase Auth signUp endpoint's `data` payload. Tenant + portal_user +
// public.users rows are committed later by chiefos_finish_signup() RPC, which
// reads exclusively from raw_user_meta_data. See migration
// migrations/2026_04_29_amendment_p1a7_chiefos_finish_signup_rpc.sql.
//
// Tester mode additionally records a chiefos_beta_signups row so /api/tester-
// access/activate can resolve entitlement after email confirmation.
// ─────────────────────────────────────────────────────────────────────────────

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

function cleanEmail(x: any) {
  return String(x || "").trim().toLowerCase();
}

function cleanPassword(x: any) {
  return String(x || "");
}

function cleanText(x: any) {
  return String(x || "").trim();
}

// Resolves the email-confirmation redirect URL from the request host so a
// signup submitted to a preview deployment redirects back to that same
// preview (instead of leaking through to production via a hardcoded base).
//
// Trust posture: Vercel sets `x-forwarded-host` to the actual deployment
// hostname; we still allowlist before using it (cheap defense against
// host-header injection at any non-Vercel edge / future deploy target).
// If host fails the allowlist or headers are stripped (SSR edges,
// scheduled jobs, future programmatic callers), fall back to
// NEXT_PUBLIC_APP_BASE_URL → hardcoded production.
const HOST_ALLOWLIST = /^(app\.usechiefos\.com|chiefos-site-.*-scott-jutras-projects\.vercel\.app)$/;

function canonicalCallbackUrl(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";

  if (host && HOST_ALLOWLIST.test(host)) {
    return `${proto}://${host}/auth/callback?returnTo=/app`;
  }

  // Fallback when headers absent or host fails allowlist
  const base = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");
  return `${base}/auth/callback?returnTo=/app`;
}

function adminClient() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = mustEnv("TURNSTILE_SECRET_KEY");
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await r.json().catch(() => ({}));
  return !!data?.success;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const body = await req.json().catch(() => ({}));
    const email = cleanEmail(body?.email);
    const password = cleanPassword(body?.password);
    const turnstileToken = cleanText(body?.turnstileToken);

    const ownerName = cleanText(body?.ownerName) || null;
    const ownerPhone = cleanText(body?.ownerPhone).replace(/\D/g, "");
    const companyName = cleanText(body?.companyName);
    const rawCountry = cleanText(body?.country).toUpperCase();
    const country = rawCountry === "CA" || rawCountry === "US" ? rawCountry : null;
    const province = cleanText(body?.province).toUpperCase() || null;
    const signupMode = cleanText(body?.signupMode).toLowerCase() === "tester" ? "tester" : "standard";
    const requestedPlanKey = cleanText(body?.requestedPlanKey) || null;

    const termsAcceptedAt = cleanText(body?.termsAcceptedAt);
    const privacyAcceptedAt = cleanText(body?.privacyAcceptedAt);
    const aiPolicyAcceptedAt = cleanText(body?.aiPolicyAcceptedAt);
    const dpaAcknowledgedAt = cleanText(body?.dpaAcknowledgedAt);

    const termsVersion = cleanText(body?.termsVersion);
    const privacyVersion = cleanText(body?.privacyVersion);
    const aiPolicyVersion = cleanText(body?.aiPolicyVersion);
    const dpaVersion = cleanText(body?.dpaVersion);

    if (!email || !email.includes("@")) return json(400, { ok: false, error: "Missing or invalid email." });
    if (!password) return json(400, { ok: false, error: "Missing password." });
    if (!turnstileToken) return json(400, { ok: false, error: "Bot check required." });

    // Phone is the WhatsApp identity boundary — fail-closed at the FE layer too.
    if (!ownerPhone || ownerPhone.length < 7) {
      return json(400, { ok: false, error: "A valid phone number is required to link your WhatsApp account." });
    }
    if (!companyName) return json(400, { ok: false, error: "Company name is required." });
    if (!country) return json(400, { ok: false, error: "Country is required." });

    if (
      !termsAcceptedAt || !privacyAcceptedAt || !aiPolicyAcceptedAt || !dpaAcknowledgedAt ||
      !termsVersion || !privacyVersion || !aiPolicyVersion || !dpaVersion
    ) {
      return json(400, { ok: false, error: "Legal acceptance is required." });
    }

    const tsOk = await verifyTurnstile(turnstileToken, ip);
    if (!tsOk) return json(400, { ok: false, error: "Bot check failed. Try again." });

    const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    // accepted_via encodes CHANNEL (portal/whatsapp/email/api per the
    // chiefos_legal_acceptances CHECK constraint), not signup-lifecycle.
    // Both standard and tester signups happen via the portal/web app.
    // Lifecycle distinction (standard vs tester) is captured separately
    // in signup_mode below.
    const acceptedVia = "portal";

    // GoTrue /signup body: top-level `data` becomes raw_user_meta_data on the
    // newly created auth.users row. chiefos_finish_signup() reads from there.
    const signupBody = {
      email,
      password,
      data: {
        owner_name: ownerName,
        owner_phone: ownerPhone,
        company_name: companyName,
        country,
        province,
        signup_mode: signupMode,
        requested_plan_key: requestedPlanKey,

        terms_accepted_at: termsAcceptedAt,
        privacy_accepted_at: privacyAcceptedAt,
        ai_policy_accepted_at: aiPolicyAcceptedAt,
        dpa_acknowledged_at: dpaAcknowledgedAt,

        terms_version: termsVersion,
        privacy_version: privacyVersion,
        ai_policy_version: aiPolicyVersion,
        dpa_version: dpaVersion,

        accepted_via: acceptedVia,
      },
      options: { emailRedirectTo: canonicalCallbackUrl(req) },
    };

    const r = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify(signupBody),
    });

    const payload = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = payload?.msg || payload?.error_description || payload?.error || "Signup failed.";
      return json(400, { ok: false, error: String(msg) });
    }

    // Tester mode: log a chiefos_beta_signups row so an admin can flip
    // status='approved' + set entitlement_plan, which /api/tester-access/activate
    // reads after email confirmation. Manual check-then-insert because the
    // table has no UNIQUE constraint on email (just a non-unique index).
    if (signupMode === "tester") {
      const admin = adminClient();
      const { data: existingBeta } = await admin
        .from("chiefos_beta_signups")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (!existingBeta) {
        const { error: betaErr } = await admin.from("chiefos_beta_signups").insert({
          email,
          name: ownerName,
          phone: ownerPhone,
          ip,
          source: "tester_signup",
          plan: requestedPlanKey || "starter_tester",
          status: "requested",
        });
        if (betaErr) {
          // Non-fatal — auth user is already created; tester can be approved
          // manually via direct DB if this row write fails.
          console.warn("[signup] chiefos_beta_signups insert failed:", betaErr.message);
        }
      }
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Signup error." });
  }
}
