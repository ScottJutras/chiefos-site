import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 m"),
  analytics: true,
  prefix: "chiefos:early_access",
});

type Plan = "free" | "starter" | "pro" | "unknown";

function normalizePlan(v: any): Plan {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return "unknown";
}

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

async function sendPostmarkEmail(subject: string, textBody: string) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) throw new Error("Missing POSTMARK_SERVER_TOKEN");

  const from = process.env.POSTMARK_FROM;
  if (!from) throw new Error("Missing POSTMARK_FROM (must be a verified sender in Postmark)");

  const r = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: "scott@scottjutras.com",
      Subject: subject,
      TextBody: textBody,
      MessageStream: "outbound",
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Postmark error: ${err}`);
  }
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    const { name, email, phone, plan, turnstileToken } = await req.json();

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanPlan = normalizePlan(plan);

    if (!cleanName || !cleanEmail) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    if (!turnstileToken) {
      return NextResponse.json({ error: "Bot check required." }, { status: 400 });
    }

    const rlKey = `${String(ip || "noip")}:${cleanEmail}`;
    const { success } = await ratelimit.limit(rlKey);
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }

    const ok = await verifyTurnstile(String(turnstileToken), ip);
    if (!ok) {
      return NextResponse.json({ error: "Bot check failed. Try again." }, { status: 400 });
    }

    // Insert lead into Supabase using Service Role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // ✅ IMPORTANT: This assumes your table has a "plan" column.
    // If it doesn't, Supabase will error. Add the column OR remove "plan" from this payload.
    const payload: Record<string, any> = {
      email: cleanEmail,
      name: cleanName,
      phone: cleanPhone,
      ip,
      source: "pricing_or_site", // you can refine later (ex: "pricing", "homepage")
      plan: cleanPlan,
    };

    const insert = await fetch(`${supabaseUrl}/rest/v1/chiefos_beta_signups`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([payload]),
    });

    if (!insert.ok) {
      const t = await insert.text();
      throw new Error(`Supabase insert failed: ${t}`);
    }

    await sendPostmarkEmail(
      `ChiefOS Early Access (${cleanPlan}): ${cleanName}`,
      [
        "New early access request:",
        "",
        `Plan: ${cleanPlan}`,
        `Name: ${cleanName}`,
        `Email: ${cleanEmail}`,
        `Phone: ${cleanPhone || "—"}`,
        `IP: ${ip || "—"}`,
        "",
      ].join("\n")
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Request error." }, { status: 500 });
  }
}
