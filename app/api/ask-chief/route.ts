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
  return NextResponse.json(
    { ok: false, code, message, ...(extra || {}) },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return jsonErr(
        "AUTH_REQUIRED",
        "Missing session. Please log in again.",
        401
      );
    }

    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Forward request to core. Core is source of truth for:
    // - tenant isolation
    // - plan gating (digits-based billing identity)
    // - permissions
    // - deterministic codes + evidence contract
    const upstream = await fetch(`${core}/api/ask-chief`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // Optional: preserve original IP/proxy headers if needed later
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();

    // Attempt JSON pass-through
    try {
      const json = JSON.parse(text);

      // If core returns nonstandard errors, normalize minimal contract:
      // UI expects ok:boolean + code on gate failures.
      if (typeof json?.ok !== "boolean") {
        return jsonErr(
          "ERROR",
          "Ask Chief core returned an invalid response shape.",
          502,
          { raw: json }
        );
      }

      return NextResponse.json(json, { status: upstream.status });
    } catch {
      // Non-JSON response from core
      return jsonErr(
        "ERROR",
        "Ask Chief core returned a non-JSON response.",
        502,
        { raw: text?.slice(0, 500) }
      );
    }
  } catch (e: any) {
    // If CHIEF_CORE_API_BASE_URL missing, etc.
    return jsonErr("ERROR", e?.message || "Ask Chief failed.", 500);
  }
}
