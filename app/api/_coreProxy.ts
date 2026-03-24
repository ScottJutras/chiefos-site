import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 25000;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function makeTraceId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isAbortError(err: unknown) {
  return !!err && typeof err === "object" && "name" in err && (err as any).name === "AbortError";
}

function noStoreHeaders(contentType?: string) {
  return {
    "Cache-Control": "no-store",
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function askChiefTimeoutEnvelope(traceId: string) {
  return {
    ok: false,
    code: "UPSTREAM_TIMEOUT",
    message: "I’m having trouble reasoning right now. Your data is safe. Try again.",
    traceId,
  };
}

function genericTimeoutEnvelope(traceId: string) {
  return {
    ok: false,
    code: "UPSTREAM_TIMEOUT",
    message: "The request took too long. Please try again.",
    traceId,
  };
}

/**
 * Proxies a request to core while preserving method + body,
 * and passes through status + content-type safely.
 *
 * Critical behavior:
 * - hard timeout before platform timeout
 * - structured fallback for Ask Chief
 * - trace id + latency logs
 */
export async function proxyToCore(req: NextRequest, upstreamPath: string) {
  const traceId = req.headers.get("x-trace-id") || makeTraceId();
  const startedAt = Date.now();

  const token = bearerFromReq(req);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        code: "AUTH_REQUIRED",
        message: "Missing session. Please log in again.",
        traceId,
      },
      {
        status: 401,
        headers: noStoreHeaders("application/json"),
      }
    );
  }

  const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");
  const url = `${core}${upstreamPath.startsWith("/") ? "" : "/"}${upstreamPath}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const timeoutMs = Number(process.env.CORE_PROXY_TIMEOUT_MS || DEFAULT_UPSTREAM_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let rawBody: string | undefined;
  if (hasBody) {
    rawBody = await req.text();
  }

  try {
    console.info("[CORE_PROXY_START]", {
      traceId,
      method,
      upstreamPath,
      url,
      timeoutMs,
    });

    const upstream = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Trace-Id": traceId,
        ...(hasBody
          ? { "Content-Type": req.headers.get("content-type") || "application/json" }
          : {}),
      },
      body: rawBody,
      cache: "no-store",
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - startedAt;
    const ct = upstream.headers.get("content-type") || "";

    console.info("[CORE_PROXY_END]", {
      traceId,
      method,
      upstreamPath,
      status: upstream.status,
      elapsedMs,
      contentType: ct || null,
    });

    if (ct.includes("application/json")) {
      const body = await upstream.json().catch(() => null);
      return NextResponse.json(body ?? { ok: upstream.ok, traceId }, {
        status: upstream.status,
        headers: noStoreHeaders("application/json"),
      });
    }

    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, {
      status: upstream.status,
      headers: noStoreHeaders(ct || "text/plain"),
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const isTimeout = isAbortError(err);

    console.error("[CORE_PROXY_ERROR]", {
      traceId,
      method,
      upstreamPath,
      elapsedMs,
      isTimeout,
      error: err instanceof Error ? err.message : String(err),
    });

    if (isTimeout) {
      const isAskChief = upstreamPath === "/api/ask-chief";

      return NextResponse.json(
        isAskChief ? askChiefTimeoutEnvelope(traceId) : genericTimeoutEnvelope(traceId),
        {
          status: 504,
          headers: noStoreHeaders("application/json"),
        }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "UPSTREAM_ERROR",
        message: "The service is temporarily unavailable. Please try again.",
        traceId,
      },
      {
        status: 502,
        headers: noStoreHeaders("application/json"),
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}