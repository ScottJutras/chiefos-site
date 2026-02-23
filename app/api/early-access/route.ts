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

function getEnv(name: string) {
  const v = process.env[name];
  return v ? String(v) : "";
}

function cleanEmail(x: any) {
  return String(x || "").trim().toLowerCase();
}

function cleanPlan(x: any): "free" | "starter" | "pro" {
  const s = String(x || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return "starter";
}

async function serviceFetch(pathAndQuery: string, init?: RequestInit) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const service = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const r = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return c;
    }
  });
}

function buildSignupUrl(appBase: string, opts: { plan: "free" | "starter" | "pro"; email: string; name?: string | null }) {
  const qp = new URLSearchParams();
  qp.set("plan", opts.plan);
  qp.set("email", opts.email);
  if (opts.name && String(opts.name).trim()) qp.set("name", String(opts.name).trim());
  return `${appBase.replace(/\/$/, "")}/signup?${qp.toString()}`;
}

async function sendPostmarkEmail(opts: { to: string; name?: string | null; plan: "free" | "starter" | "pro" }) {
  const token = getEnv("POSTMARK_SERVER_TOKEN");
  const from = getEnv("POSTMARK_FROM");
  if (!token || !from) {
    // Don’t crash early-access if email isn't configured
    return { ok: false as const, skipped: true as const, reason: "missing-postmark-env" };
  }

  const stream = getEnv("POSTMARK_MESSAGE_STREAM") || "outbound";
  const appBase = getEnv("NEXT_PUBLIC_APP_BASE_URL") || "https://app.usechiefos.com";
  const safeName = (opts.name || "").trim();

  // ✅ Correct CTA: create owner account (prefilled) instead of /login
  const signupUrl = buildSignupUrl(appBase, { plan: opts.plan, email: opts.to, name: safeName || null });
  const loginUrl = `${appBase.replace(/\/$/, "")}/login`;

  const subject = `ChiefOS early access request received (${opts.plan.toUpperCase()})`;

  const textBody = [
    `Hey${safeName ? ` ${safeName}` : ""},`,
    ``,
    `We received your ChiefOS early access request for ${opts.plan.toUpperCase()}.`,
    `Next step: create your owner account so we can attach approval to the right login.`,
    ``,
    `Create owner account: ${signupUrl}`,
    `Already have an account? Log in: ${loginUrl}`,
    ``,
    `— ChiefOS`,
  ].join("\n");

  const htmlBody = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5; color:#111;">
      <p>Hey${safeName ? ` ${escapeHtml(safeName)}` : ""},</p>

      <p>
        We received your <b>ChiefOS early access</b> request for
        <b>${opts.plan.toUpperCase()}</b>.
      </p>

      <p style="margin-top:14px;">
        <b>Next step:</b> Create your <b>owner account</b> so we can attach approval to the right login.
      </p>

      <p style="margin-top:16px;">
        <a href="${signupUrl}" style="display:inline-block; background:#111; color:#fff; padding:10px 14px; border-radius:10px; text-decoration:none;">
          Create owner account
        </a>
      </p>

      <p style="margin-top:10px; font-size:13px; color:#555;">
        Already have an account?
        <a href="${loginUrl}" style="color:#111; text-decoration:underline;">Log in</a>
      </p>

      <p style="margin-top:18px; color:#555; font-size:13px;">
        — ChiefOS
      </p>
    </div>
  `;

  const r = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: opts.to,
      Subject: subject,
      TextBody: textBody,
      HtmlBody: htmlBody,
      MessageStream: stream,
    }),
  });

  const text = await r.text();
  if (!r.ok) {
    return {
      ok: false as const,
      skipped: false as const,
      reason: `postmark-${r.status}`,
      raw: text.slice(0, 300),
    };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = cleanEmail(body?.email);
    const name = String(body?.name || "").trim() || null;
    const phone = String(body?.phone || "").trim() || null;
    const source = String(body?.source || "").trim() || "pricing_or_site";
    const plan = cleanPlan(body?.plan);

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    if (!email || !email.includes("@")) {
      return json(400, { ok: false, error: "Missing or invalid email." });
    }

    // 1) Read existing row (NO updated_at)
    const q = new URLSearchParams();
    q.set("select", "id,email,status,entitlement_plan,approved_at,plan,created_at");
    q.set("email", `eq."${email}"`);
    q.set("order", "created_at.desc");
    q.set("limit", "1");

    const existing = await serviceFetch(`chiefos_beta_signups?${q.toString()}`);
    const row0 = Array.isArray(existing) ? existing[0] : null;

    const existingStatus = String(row0?.status || "").toLowerCase();
    const lockedStatus = existingStatus === "approved" || existingStatus === "denied";

    // 2) Upsert payload (only existing columns)
    const payload: Record<string, any> = {
      email,
      name,
      phone,
      ip,
      source,
      plan,
      entitlement_plan: plan,
    };

    // Only set requested if not locked; never touch approved_at
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

    // 3) Send confirmation email (does not block success if Postmark misconfigured)
    const mail = await sendPostmarkEmail({ to: email, name, plan });

    return json(200, {
      ok: true,
      status: lockedStatus ? existingStatus : "requested",
      email: out?.email || email,
      plan,
      locked: lockedStatus,
      emailed: mail.ok === true,
      email_skipped: (mail as any)?.skipped === true ? true : false,
      email_reason: (mail as any)?.reason || null,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Early access failed." });
  }
}