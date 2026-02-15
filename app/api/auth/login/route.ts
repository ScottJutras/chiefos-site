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

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function supabaseAdminGetOwnerIdByAuthUserId(authUserId: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Assumes: public.user_auth_links(auth_user_id, owner_id)
  const url =
    `${supabaseUrl}/rest/v1/user_auth_links` +
    `?auth_user_id=eq.${encodeURIComponent(authUserId)}` +
    `&select=owner_id&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`user_auth_links lookup failed: ${t}`);
  }

  const rows = (await r.json()) as Array<{ owner_id?: string | null }>;
  const ownerId = String(rows?.[0]?.owner_id || "")
    .replace(/\D/g, "")
    .trim();

  return ownerId || null;
}

async function supabaseAdminGetDashboardTokenByOwnerId(ownerId: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Assumes: public.users(user_id, dashboard_token)
  const url =
    `${supabaseUrl}/rest/v1/users` +
    `?user_id=eq.${encodeURIComponent(ownerId)}` +
    `&select=dashboard_token&limit=1`;

  const r = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`users dashboard_token lookup failed: ${t}`);
  }

  const rows = (await r.json()) as Array<{ dashboard_token?: string | null }>;
  const token = String(rows?.[0]?.dashboard_token || "").trim();
  return token || null;
}

function setDashboardCookie(res: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set({
    name: "chiefos_dashboard_token",
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    // Important: domain should NOT be set on localhost/dev or the cookie won't stick
    ...(isProd ? { domain: ".usechiefos.com" } : {}),
  });
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
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
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

    const authUserId = String(payload?.user?.id || "").trim();
    if (!authUserId) {
      return NextResponse.json({ error: "Login succeeded but missing user id." }, { status: 500 });
    }

    // Resolve owner + dashboard token for billing auth
    const ownerId = await supabaseAdminGetOwnerIdByAuthUserId(authUserId);
    if (!ownerId) {
      // This is the expected case until link-phone exists
      return NextResponse.json(
        { error: "Account not linked yet. Please link your phone to continue." },
        { status: 409 }
      );
    }

    const dashToken = await supabaseAdminGetDashboardTokenByOwnerId(ownerId);
    if (!dashToken) {
      return NextResponse.json({ error: "Missing dashboard token for owner." }, { status: 500 });
    }

    const res = NextResponse.json({
      session: {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_in: payload.expires_in,
        token_type: payload.token_type,
        user: payload.user,
      },
      owner_id: ownerId, // helpful for debugging/UI, not trusted for gating
      linked: true,
    });

    setDashboardCookie(res, dashToken);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Login error." }, { status: 500 });
  }
}
