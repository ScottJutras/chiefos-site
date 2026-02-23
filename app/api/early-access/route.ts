// app/api/early-access/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function cleanEmail(x: any) {
  return String(x || "").trim().toLowerCase();
}

function cleanText(x: any) {
  const s = String(x || "").trim();
  return s.length ? s : null;
}

function cleanPlan(x: any): "free" | "starter" | "pro" {
  const s = String(x || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return "starter";
}

async function serviceFetch(pathAndQuery: string, init?: RequestInit) {
  const base = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const service = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const r = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!r.ok) {
    const msg =
      typeof data === "string"
        ? data
        : data?.message || data?.error || data?.hint || `Supabase request failed (${r.status}).`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Optional: send confirmation email via Resend
 * - If RESEND_API_KEY or EARLY_ACCESS_FROM is missing -> silently skip (do not break UX)
 */
async function maybeSendConfirmationEmail(opts: {
  to: string;
  plan: "free" | "starter" | "pro";
  name?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EARLY_ACCESS_FROM; // e.g. "ChiefOS <hello@usechiefos.com>"
  const appBase = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");

  if (!apiKey || !from) return;

  const { to, plan, name } = opts;

  const subject = `ChiefOS early access request received`;
  const greeting = name ? `Hey ${name},` : `Hey,`;

  // Keep it simple, plaintext-safe HTML
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
      <p>${greeting}</p>
      <p>We received your early access request for <b>${plan.toUpperCase()}</b>.</p>
      <p>Next steps:</p>
      <ol>
        <li>If you already created an account, you can log in here: <a href="${appBase}/login">${appBase}/login</a></li>
        <li>If you haven’t created an account yet, create one here: <a href="${appBase}/signup?plan=${plan}">${appBase}/signup?plan=${plan}</a></li>
      </ol>
      <p style="color:#666; font-size:12px;">If you didn’t request this, you can ignore this email.</p>
    </div>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  // Don’t break the request if email fails — but do throw to logs if you want strictness.
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // soft-fail: log to server output
    console.warn("Resend email failed:", res.status, errText.slice(0, 500));
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = cleanEmail(body?.email);
    const name = cleanText(body?.name);
    const phone = cleanText(body?.phone);
    const source = cleanText(body?.source) || "pricing_or_site";
    const plan = cleanPlan(body?.plan);

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    if (!email || !email.includes("@")) {
      return json(400, { ok: false, error: "Missing or invalid email." });
    }

    // 1) Read existing row (NO updated_at anywhere)
    const q = new URLSearchParams();
    q.set("select", "id,email,status,entitlement_plan,approved_at,plan,created_at");
    q.set("email", `eq."${email}"`);
    q.set("order", "created_at.desc");
    q.set("limit", "1");

    const existing = await serviceFetch(`chiefos_beta_signups?${q.toString()}`);
    const row0 = Array.isArray(existing) ? existing[0] : null;

    const existingStatus = String(row0?.status || "").toLowerCase();
    const lockedStatus = existingStatus === "approved" || existingStatus === "denied";

    // 2) Upsert payload (ONLY existing columns)
    const payload: Record<string, any> = {
      email,
      name,
      phone,
      ip,
      source,
      plan,
      entitlement_plan: plan,
      // DO NOT include updated_at
      // DO NOT touch approved_at
    };

    // Never downgrade approvals/denials
    if (!lockedStatus) payload.status = "requested";

    const upserted = await serviceFetch(`chiefos_beta_signups?on_conflict=email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    const out = Array.isArray(upserted) ? upserted[0] : upserted;

    // 3) Optional: confirmation email (soft-fail)
    await maybeSendConfirmationEmail({ to: email, plan, name });

    return json(200, {
      ok: true,
      status: lockedStatus ? existingStatus : "requested",
      email: out?.email || email,
      plan,
      locked: lockedStatus,
      emailed: Boolean(process.env.RESEND_API_KEY && process.env.EARLY_ACCESS_FROM),
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Early access failed." });
  }
}