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

async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Missing TURNSTILE_SECRET_KEY");

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });

  const data = await r.json();
  return !!data?.success;
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    const { email, password, turnstileToken } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password." }, { status: 400 });
    }
    if (!turnstileToken) {
      return NextResponse.json({ error: "Bot check required." }, { status: 400 });
    }

    const rlKey = `${String(ip || "noip")}:${String(email).toLowerCase()}`;
    const { success } = await ratelimit.limit(rlKey);
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
    }

    const ok = await verifyTurnstile(String(turnstileToken), ip);
    if (!ok) {
      return NextResponse.json({ error: "Bot check failed. Try again." }, { status: 400 });
    }

    // Call Supabase Auth (password grant) server-side
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { error: payload?.error_description || payload?.error || "Login failed." },
        { status: 401 }
      );
    }

    // Return session to client so it can setSession()
    return NextResponse.json({
      session: {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_in: payload.expires_in,
        token_type: payload.token_type,
        user: payload.user,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login error." }, { status: 500 });
  }
}
