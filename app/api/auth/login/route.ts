// chiefos-site/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 attempts / minute
  analytics: true,
  prefix: "chiefos:auth:login",
});

function requireEnv(name: string) {
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

async function verifyTurnstile(turnstileToken: string, ip?: string | null) {
  const secret = requireEnv("TURNSTILE_SECRET_KEY");

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", turnstileToken);
  if (ip) form.append("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const data = await r.json();
  return !!data?.success;
}

async function supabasePasswordGrant(email: string, password: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Server-side password grant against Supabase Auth
  const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await r.json().catch(() => ({}));

  if (!r.ok) {
    return {
      ok: false as const,
      error: String(payload?.error_description || payload?.error || "Login failed."),
      status: 401,
    };
  }

  const access_token = String(payload?.access_token || "").trim();
  const refresh_token = String(payload?.refresh_token || "").trim();
  const user = payload?.user;

  if (!access_token || !user) {
    return {
      ok: false as const,
      error: "Login succeeded but missing session/user.",
      status: 500,
    };
  }

  return {
    ok: true as const,
    session: {
      access_token,
      refresh_token,
      expires_in: payload?.expires_in,
      token_type: payload?.token_type,
      user,
    },
  };
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const { email, password, turnstileToken } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Missing email or password." }, { status: 400 });
    }
    if (!turnstileToken) {
      return NextResponse.json({ ok: false, error: "Bot check required." }, { status: 400 });
    }

    // Rate limit on (ip + email)
    const rlKey = `${String(ip || "noip")}:${String(email).toLowerCase()}`;
    const rl = await ratelimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Try again shortly." },
        { status: 429 }
      );
    }

    // Turnstile
    const tsOk = await verifyTurnstile(String(turnstileToken), ip);
    if (!tsOk) {
      return NextResponse.json({ ok: false, error: "Bot check failed. Try again." }, { status: 400 });
    }

    // Supabase Auth (anon-only)
    const auth = await supabasePasswordGrant(String(email), String(password));
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    // IMPORTANT:
    // No service-role lookups, no DB joins, no HttpOnly cookies.
    // Portal client will store session using Supabase JS.

    return NextResponse.json(
      {
        ok: true,
        session: auth.session,
        user: auth.session.user,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Login error." }, { status: 500 });
  }
}
