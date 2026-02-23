import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function normalizeEmail(raw: any): string {
  return String(raw || "").trim().toLowerCase();
}

function normalizePlan(raw: any): "free" | "starter" | "pro" | null {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

async function serviceFetch(pathAndQuery: string, init?: RequestInit) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const service = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const r = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
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
      (data && (data.message || data.error || data.hint)) ||
      `Supabase request failed (${r.status}).`;
    throw new Error(msg);
  }

  return data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const cleanEmail = normalizeEmail(body?.email);
    if (!cleanEmail) return json(400, { ok: false, error: "Missing email." });

    const requestedPlan = normalizePlan(body?.plan) || "starter";
    const entitlementPlan = normalizePlan(body?.entitlementPlan) || requestedPlan;

    // ---------------------------
    // ✅ Read existing so we NEVER downgrade approvals
    // ---------------------------
    const q = new URLSearchParams();
    q.set("select", "email,status,entitlement_plan,approved_at,plan");
    q.set("email", `eq."${cleanEmail}"`);
    q.set("limit", "1");

    const existing = await serviceFetch(`chiefos_beta_signups?${q.toString()}`);
    const row0 = Array.isArray(existing) ? existing[0] : null;

    const existingStatus = String(row0?.status || "").toLowerCase();
    const lockedStatus = existingStatus === "approved" || existingStatus === "denied";

    // ---------------------------
    // Upsert payload: always safe lead fields
    // ---------------------------
    const nowIso = new Date().toISOString();

    // If locked, do NOT change status/approved_at/plan. Only allow harmless fields.
    const payload: any = {
      email: cleanEmail,
      updated_at: nowIso,
    };

    if (!lockedStatus) {
      // Status is only set to requested if not locked
      payload.status = "requested";
      payload.plan = requestedPlan;
      payload.entitlement_plan = entitlementPlan;
    } else {
      // Keep entitlement_plan/plan untouched when locked
      // (optional: still allow updating entitlement_plan if you want — but safest is NO)
    }

    // ---------------------------
    // Upsert by unique email index
    // ---------------------------
    const upsertPath = `chiefos_beta_signups?on_conflict=email`;
    const result = await serviceFetch(upsertPath, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    return json(200, {
      ok: true,
      email: cleanEmail,
      locked: lockedStatus,
      status: lockedStatus ? existingStatus : "requested",
      row: Array.isArray(result) ? result[0] : result,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "early-access failed" });
  }
}