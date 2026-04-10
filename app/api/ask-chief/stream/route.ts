// app/api/ask-chief/stream/route.ts
// SSE pass-through proxy for the streaming Ask Chief endpoint.
//
// Unlike _coreProxy (which buffers via upstream.json()), this route pipes the
// upstream ReadableStream directly so SSE tokens reach the browser as they arrive.
//
// Auth: requires Bearer token in Authorization header (same as /api/ask-chief).

import { type NextRequest } from "next/server";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 35; // slightly above STREAM_TIMEOUT_MS on the core

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function makeTraceId() {
  try { return crypto.randomUUID(); }
  catch { return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
}

function bearerFromReq(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") || makeTraceId();

  const token = bearerFromReq(req);
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, code: "AUTH_REQUIRED", message: "Missing session. Please log in again.", traceId }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");
  const upstream_url = `${core}/api/ask-chief/stream`;

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    rawBody = "{}";
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstream_url, {
      method: "POST",
      headers: {
        "Authorization":  `Bearer ${token}`,
        "Content-Type":   "application/json",
        "X-Trace-Id":     traceId,
        "Accept":         "text/event-stream",
      },
      body: rawBody,
      // @ts-expect-error — Node.js fetch supports duplex for streaming
      duplex: "half",
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[STREAM_PROXY_FETCH_FAILED]", { traceId, error: msg });
    return new Response(
      JSON.stringify({ ok: false, code: "UPSTREAM_ERROR", message: "Chief is temporarily unavailable.", traceId }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok && !upstream.headers.get("content-type")?.includes("text/event-stream")) {
    // Non-SSE error from core (e.g., plan gate returned JSON 200) — pass through as-is
    const body = await upstream.text().catch(() => "");
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  // Pipe the SSE stream directly to the browser
  const responseHeaders = new Headers({
    "Content-Type":      "text/event-stream",
    "Cache-Control":     "no-cache",
    "Connection":        "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Trace-Id":        traceId,
  });

  return new Response(upstream.body, {
    status: 200,
    headers: responseHeaders,
  });
}
