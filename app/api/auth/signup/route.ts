// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 signups / 10 min per key
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

function canonicalCallbackUrl() {
  const base = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");
  return `${base}/auth/callback`;
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
    const turnstileToken = String(body?.turnstileToken || "");

    if (!email || !email.includes("@")) {
      return json(400, { ok: false, error: "Missing or invalid email." });
    }
    if (!password) {
      return json(400, { ok: false, error: "Missing password." });
    }
    if (!turnstileToken) {
      return json(400, { ok: false, error: "Bot check required." });
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

    // ✅ Canonical redirect (do NOT trust window.location.origin)
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
      // Supabase commonly returns { msg } or { error_description } etc.
      const msg =
        payload?.msg ||
        payload?.error_description ||
        payload?.error ||
        "Signup failed.";
      return json(400, { ok: false, error: String(msg) });
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Signup error." });
  }
}