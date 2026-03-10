import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  analytics: true,
  prefix: "chiefos:auth:signup",
});

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

function canonicalCallbackUrl() {
  const base = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");
  return `${base}/auth/callback?returnTo=/app`;
}

function adminClient() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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

    const companyName = cleanText(body?.companyName);
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

    if (!email || !email.includes("@")) {
      return json(400, { ok: false, error: "Missing or invalid email." });
    }
    if (!password) {
      return json(400, { ok: false, error: "Missing password." });
    }
    if (!turnstileToken) {
      return json(400, { ok: false, error: "Bot check required." });
    }

    if (
      !termsAcceptedAt ||
      !privacyAcceptedAt ||
      !aiPolicyAcceptedAt ||
      !dpaAcknowledgedAt ||
      !termsVersion ||
      !privacyVersion ||
      !aiPolicyVersion ||
      !dpaVersion
    ) {
      return json(400, { ok: false, error: "Legal acceptance is required." });
    }

    const rlKey = `${String(ip || "noip")}:${email}`;
    const { success } = await ratelimit.limit(rlKey);
    if (!success) {
      return json(429, { ok: false, error: "Too many attempts. Try again later." });
    }

    const tsOk = await verifyTurnstile(turnstileToken, ip);
    if (!tsOk) {
      return json(400, { ok: false, error: "Bot check failed. Try again." });
    }

    const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
    const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const emailRedirectTo = canonicalCallbackUrl();

    const r = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        options: { emailRedirectTo },
      }),
    });

    const payload = await r.json().catch(() => ({}));

    if (!r.ok) {
      const msg =
        payload?.msg ||
        payload?.error_description ||
        payload?.error ||
        "Signup failed.";
      return json(400, { ok: false, error: String(msg) });
    }

    const admin = adminClient();

    const { error: pendingErr } = await admin
      .from("chiefos_pending_signups")
      .upsert(
        {
          email,
          company_name: companyName || null,
          signup_mode: signupMode,
          requested_plan_key: requestedPlanKey,

          terms_accepted_at: termsAcceptedAt,
          terms_version: termsVersion,

          privacy_accepted_at: privacyAcceptedAt,
          privacy_version: privacyVersion,

          ai_policy_accepted_at: aiPolicyAcceptedAt,
          ai_policy_version: aiPolicyVersion,

          dpa_acknowledged_at: dpaAcknowledgedAt,
          dpa_version: dpaVersion,

          accepted_via: signupMode === "tester" ? "tester_signup" : "signup",
          consumed_at: null,
        },
        { onConflict: "email" }
      );

    if (pendingErr) {
      return json(500, { ok: false, error: pendingErr.message || "Failed to store signup bootstrap." });
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Signup error." });
  }
}