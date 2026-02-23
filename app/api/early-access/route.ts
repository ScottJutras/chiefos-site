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

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizePlan(v: any): Plan {
  const s = String(v || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return "unknown";
}

function planLabel(plan: Plan) {
  if (plan === "free") return "Free — Field Capture";
  if (plan === "starter") return "Starter — Owner Mode";
  if (plan === "pro") return "Pro — Crew + Control";
  return "Unknown";
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

async function sendPostmarkEmail(opts: { to: string; subject: string; textBody: string }) {
  const token = mustEnv("POSTMARK_SERVER_TOKEN");
  const from = mustEnv("POSTMARK_FROM");

  const r = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: opts.to,
      Subject: opts.subject,
      TextBody: opts.textBody,
      MessageStream: "outbound",
    }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    throw new Error(`Postmark error: ${err}`);
  }
}

async function serviceFetch(path: string) {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });

  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

async function serviceUpsertBetaSignup(row: any) {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const r = await fetch(`${supabaseUrl}/rest/v1/chiefos_beta_signups?on_conflict=email`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      // merge duplicates so name/phone/plan update; we prevent approval overwrite by not sending those fields
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([row]),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Supabase upsert failed: ${t}`);
  }
}

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    const { name, email, phone, plan, turnstileToken } = await req.json().catch(() => ({}));

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

    // Read existing so we NEVER downgrade approvals
    const existing = await serviceFetch(
      `chiefos_beta_signups?select=email,status,entitlement_plan,approved_at,plan&email=eq.${encodeURIComponent(
        cleanEmail
      )}&limit=1`
    );
    const row0 = Array.isArray(existing) ? existing[0] : null;

    const existingStatus = String(row0?.status || "").toLowerCase();
    const lockedStatus = existingStatus === "approved" || existingStatus === "denied";

    // Upsert payload: always safe lead fields
    const payload: Record<string, any> = {
      email: cleanEmail,
      name: cleanName,
      phone: cleanPhone,
      ip,
      source: "pricing_or_site",
      plan: cleanPlan,
    };

    // Only set requested/entitlement on non-locked rows
    if (!lockedStatus) {
      payload.status = "requested";
      // set entitlement_plan only if missing (otherwise preserve whatever admin set)
      if (!row0?.entitlement_plan) payload.entitlement_plan = cleanPlan;
      // approved_at stays null until manual approval
    }

    await serviceUpsertBetaSignup(payload);

    // Internal email to you
    await sendPostmarkEmail({
      to: "scott@scottjutras.com",
      subject: `ChiefOS Early Access (${cleanPlan}): ${cleanName}`,
      textBody: [
        "New early access request:",
        "",
        `Plan: ${cleanPlan}`,
        `Name: ${cleanName}`,
        `Email: ${cleanEmail}`,
        `Phone: ${cleanPhone || "—"}`,
        `IP: ${ip || "—"}`,
        "",
        row0 ? `Existing status: ${existingStatus || "unknown"}` : "New email (first request).",
        "",
        "Next: approve in Supabase when ready (status=approved).",
      ].join("\n"),
    });

    // Requester next-steps email
    const appBase = process.env.APP_BASE_URL || "https://app.usechiefos.com";
    const base = String(appBase).replace(/\/+$/, "");
    const signupUrl = `${base}/signup?plan=${encodeURIComponent(cleanPlan === "unknown" ? "starter" : cleanPlan)}`;
    const loginUrl = `${base}/login`;

    await sendPostmarkEmail({
      to: cleanEmail,
      subject: `ChiefOS — ${planLabel(cleanPlan)} request received`,
      textBody: [
        `Hey ${cleanName},`,
        "",
        `We got your request for: ${planLabel(cleanPlan)}.`,
        "",
        "Next steps:",
        `1) Create your account (use this same email): ${signupUrl}`,
        "2) Verify your email (check inbox / spam).",
        `3) Sign in: ${loginUrl}`,
        "",
        "Once you're approved, your account will unlock automatically.",
        "",
        "— ChiefOS",
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Request error." }, { status: 500 });
  }
}