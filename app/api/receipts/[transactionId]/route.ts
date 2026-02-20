// app/api/receipts/[transactionId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function jsonErr(code: string, message: string, status = 200, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, code, message, ...(extra || {}) }, { status });
}

function getBearerFromAuthHeader(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return (m && m[1]) || null;
}

// Option A (cookies) — keep it, but it’s currently not working in your setup
async function getAccessTokenFromCookies() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
    mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // read-only route; no-op
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function GET(req: Request, ctx: { params: Promise<{ transactionId: string }> }) {
  try {
    // ✅ Prefer Authorization header (Option B). Fallback to cookies (Option A).
    const headerToken = getBearerFromAuthHeader(req);
    const cookieToken = headerToken ? null : await getAccessTokenFromCookies();
    const token = headerToken || cookieToken;

    if (!token) {
      return jsonErr("AUTH_REQUIRED", "Missing session. Please log in again.", 401);
    }

    const { transactionId } = await ctx.params;
    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");

    // Preserve ?download=1 etc.
    const url = new URL(req.url);
    const qs = url.searchParams.toString();
    const upstreamUrl = `${core}/api/receipts/${encodeURIComponent(transactionId)}${qs ? `?${qs}` : ""}`;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
    } catch (e: any) {
      const name = String(e?.name || "");
      if (name === "AbortError") return jsonErr("ERROR", "Receipt timed out. Try again.", 504);
      return jsonErr("ERROR", e?.message || "Receipt request failed.", 502);
    } finally {
      clearTimeout(t);
    }

    const ct = upstream.headers.get("content-type") || "";

    // Pass JSON errors through
    if (ct.includes("application/json")) {
      const j = await upstream.json().catch(() => null);
      return NextResponse.json(j ?? { ok: false, code: "ERROR", message: "Receipt failed." }, { status: upstream.status });
    }

    // Stream binary through
    const headers = new Headers();
    const pass = (name: string) => {
      const v = upstream.headers.get(name);
      if (v) headers.set(name, v);
    };
    pass("content-type");
    pass("content-disposition");
    pass("cache-control");

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e: any) {
    return jsonErr("ERROR", e?.message || "Receipt failed.", 500);
  }
}