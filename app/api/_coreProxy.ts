import { NextResponse, type NextRequest } from "next/server";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

/**
 * Proxies a request to core while preserving method + body,
 * and passes through status + content-type safely.
 */
export async function proxyToCore(req: NextRequest, upstreamPath: string) {
  const token = bearerFromReq(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", message: "Missing session. Please log in again." },
      { status: 401 }
    );
  }

  const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");
  const url = `${core}${upstreamPath.startsWith("/") ? "" : "/"}${upstreamPath}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const upstream = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { "Content-Type": req.headers.get("content-type") || "application/json" } : {}),
    },
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  });

  const ct = upstream.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await upstream.json().catch(() => null);
    return NextResponse.json(body ?? { ok: upstream.ok }, { status: upstream.status });
  }

  const text = await upstream.text().catch(() => "");
  return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": ct || "text/plain" } });
}