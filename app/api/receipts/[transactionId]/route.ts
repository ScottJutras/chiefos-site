// app/api/receipts/[transactionId]/route.ts
import { NextResponse, type NextRequest } from "next/server";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function jsonErr(code: string, message: string, status = 500, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, code, message, ...(extra || {}) }, { status });
}

function bearerFromReq(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await ctx.params;

    const raw = String(transactionId || "").trim();
    const txId = Number(raw);
    if (!Number.isInteger(txId) || txId <= 0) {
      return jsonErr("BAD_REQUEST", "Invalid transaction id.", 400);
    }

    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");

    // Build upstream URL (preserve ?download=1 etc.)
    const url = new URL(req.url);
    const qs = url.searchParams.toString();
    const upstreamUrl = `${core}/api/receipts/${txId}${qs ? `?${qs}` : ""}`;

    // Prefer bearer (portal). If missing, fall back to forwarding cookies (dashboard).
    const accessToken = bearerFromReq(req);
    const cookie = req.headers.get("cookie") || "";

    if (!accessToken && !cookie) {
      return jsonErr("AUTH_REQUIRED", "Missing session. Please log in again.", 401);
    }

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (!accessToken && cookie) headers.Cookie = cookie;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: ac.signal,
      });
    } catch (e: any) {
      if (String(e?.name || "") === "AbortError") {
        return jsonErr("ERROR", "Receipt timed out. Try again.", 504);
      }
      return jsonErr("ERROR", e?.message || "Receipt request failed.", 502);
    } finally {
      clearTimeout(t);
    }

    const ct = upstream.headers.get("content-type") || "";

    // Pass JSON errors through
    if (ct.includes("application/json")) {
      const j = await upstream.json().catch(() => null);
      return NextResponse.json(
        j ?? { ok: false, code: "ERROR", message: "Receipt failed." },
        { status: upstream.status }
      );
    }

    // Stream binary through
    const outHeaders = new Headers();
    for (const k of ["content-type", "content-disposition", "cache-control"]) {
      const v = upstream.headers.get(k);
      if (v) outHeaders.set(k, v);
    }

    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch (e: any) {
    return jsonErr("ERROR", e?.message || "Receipt failed.", 500);
  }
}