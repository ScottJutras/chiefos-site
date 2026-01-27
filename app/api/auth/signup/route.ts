import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

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

    const { email, password, turnstileToken, emailRedirectTo } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password." }, { status: 400 });
    }
    if (!turnstileToken) {
      return NextResponse.json({ error: "Bot check required." }, { status: 400 });
    }

    const rlKey = `${String(ip || "noip")}:${String(email).toLowerCase()}`;
    const { success } = await ratelimit.limit(rlKey);
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const ok = await verifyTurnstile(String(turnstileToken), ip);
    if (!ok) {
      return NextResponse.json({ error: "Bot check failed. Try again." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      }),
    });

    const payload = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { error: payload?.msg || payload?.error_description || payload?.error || "Signup failed." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Signup error." }, { status: 500 });
  }
}
