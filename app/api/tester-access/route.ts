// app/api/tester-access/route.ts
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
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  analytics: true,
  prefix: "chiefos:tester-access",
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

function cleanString(x: any) {
  return String(x || "").trim();
}

function cleanEmail(x: any) {
  return String(x || "").trim().toLowerCase();
}

function normalizePhone(x: any) {
  const raw = String(x || "").trim();
  if (!raw) return null;
  return raw;
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

    const name = cleanString(body?.name);
    const email = cleanEmail(body?.email);
    const phone = normalizePhone(body?.phone);
    const plan = cleanString(body?.plan).toLowerCase();
    const source = cleanString(body?.source);
    const mode = cleanString(body?.mode);
    const turnstileToken = cleanString(body?.turnstileToken);

    if (!name) {
      return json(400, { ok: false, error: "Missing name." });
    }

    if (!email || !email.includes("@")) {
      return json(400, { ok: false, error: "Missing or invalid email." });
    }

    if (!turnstileToken) {
      return json(400, { ok: false, error: "Bot check required." });
    }

    // This route is intentionally fixed to tester self-serve Starter only.
    // Do not trust arbitrary plan selection from the client on this path.
    if (plan && plan !== "starter") {
      return json(400, { ok: false, error: "Invalid tester plan." });
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

    // IMPORTANT:
    // This route intentionally does NOT create tenant / owner / plan authority yet.
    // It only validates public tester access and allows the user to proceed to signup.
    //
    // Why:
    // - No auth context exists yet
    // - tenant_id / owner_id must resolve deterministically
    // - plan authority must be server-trusted later in authenticated flow
    //
    // We return a normalized payload for the client success flow.
    return json(200, {
      ok: true,
      tester: {
        name,
        email,
        phone,
        plan: "starter",
        source: source || "tester_portal",
        mode: mode || "tester_self_serve",
      },
    });
  } catch (e: any) {
    return json(500, {
      ok: false,
      error: e?.message || "Tester access error.",
    });
  }
}