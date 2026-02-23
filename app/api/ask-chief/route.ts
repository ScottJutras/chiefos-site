// app/api/ask-chief/route.ts
import { NextResponse } from "next/server";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function jsonErr(code: string, message: string, status = 200, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, code, message, ...(extra || {}) }, { status });
}

async function getEmailFromToken(accessToken: string): Promise<string | null> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const email = j?.email ? String(j.email).trim().toLowerCase() : null;
  return email || null;
}

async function getApprovedBetaPlanByEmail(email: string): Promise<"free" | "starter" | "pro" | null> {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const service = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  const q = new URLSearchParams();
  q.set("select", "status,entitlement_plan,plan");
  q.set("email", `eq.${email}`);
  q.set("limit", "1");

  const r = await fetch(`${url}/rest/v1/chiefos_beta_signups?${q.toString()}`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
    cache: "no-store",
  });

  if (!r.ok) return null;

  const rows = (await r.json().catch(() => [])) as any[];
  const row = rows?.[0];
  if (!row) return null;

  if (String(row.status || "").toLowerCase() !== "approved") return null;

  const p = String(row.entitlement_plan || row.plan || "").toLowerCase();
  if (p === "free" || p === "starter" || p === "pro") return p;
  return null;
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return jsonErr("AUTH_REQUIRED", "Missing session. Please log in again.", 401);
    }

    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // ✅ Attach beta entitlement hint (core can choose to honor it)
    let betaPlan: string | null = null;
    try {
      const email = await getEmailFromToken(token);
      betaPlan = email ? await getApprovedBetaPlanByEmail(email) : null;
    } catch {
      betaPlan = null; // never block ask-chief
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    let upstream: Response;
    try {
      upstream = await fetch(`${core}/api/ask-chief`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(betaPlan ? { "x-chiefos-beta-plan": betaPlan } : {}),
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch (e: any) {
      const name = String(e?.name || "");
      if (name === "AbortError") {
        return jsonErr("ERROR", "Ask Chief timed out. Try again in a moment.", 504);
      }
      return jsonErr("ERROR", e?.message || "Ask Chief request failed.", 502);
    } finally {
      clearTimeout(t);
    }

    const text = await upstream.text();

    try {
      const json = JSON.parse(text);

      if (typeof json?.ok !== "boolean") {
        return jsonErr("ERROR", "Ask Chief core returned an invalid response shape.", 502, { raw: json });
      }

      return NextResponse.json(json, { status: upstream.status });
    } catch {
      return jsonErr("ERROR", "Ask Chief core returned a non-JSON response.", 502, {
        raw: text?.slice(0, 500),
      });
    }
  } catch (e: any) {
    return jsonErr("ERROR", e?.message || "Ask Chief failed.", 500);
  }
}