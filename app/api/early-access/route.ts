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

    // 1) Read existing row (safe columns only — NO updated_at)
    const q = new URLSearchParams();
    q.set("select", "id,email,status,entitlement_plan,approved_at,plan,created_at");
    q.set("email", `eq."${email}"`);
    q.set("order", "created_at.desc");
    q.set("limit", "1");

    const existing = await serviceFetch(`chiefos_beta_signups?${q.toString()}`);
    const row0 = Array.isArray(existing) ? existing[0] : null;

    const existingStatus = String(row0?.status || "").toLowerCase();
    const lockedStatus = existingStatus === "approved" || existingStatus === "denied";

    // 2) Upsert payload (only uses existing columns)
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

    // 3) Upsert by unique email
    const upserted = await serviceFetch(`chiefos_beta_signups?on_conflict=email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    const out = Array.isArray(upserted) ? upserted[0] : upserted;

    return json(200, {
      ok: true,
      status: lockedStatus ? existingStatus : "requested",
      email: out?.email || email,
      plan,
      locked: lockedStatus,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Early access failed." });
  }
}