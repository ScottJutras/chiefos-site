// app/api/receipts/[transactionId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

async function getCookieSessionAccessToken() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // ✅ Next version: cookies() is async
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });

  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

export async function GET(req: Request, ctx: { params: { transactionId: string } }) {
  try {
    const transactionId = String(ctx.params.transactionId || "").trim();
    if (!transactionId) return jsonErr("BAD_REQUEST", "Missing transactionId.", 400);

    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");

    // 1) Cookie session token (Option A)
    let accessToken = "";
    try {
      accessToken = await getCookieSessionAccessToken();
    } catch {
      // ignore; fallback to Bearer
    }

    // 2) Bearer fallback (works with your ReceiptActions fetch())
    if (!accessToken) accessToken = bearerFromReq(req);

    if (!accessToken) {
      return jsonErr("AUTH_REQUIRED", "Missing session. Please log in again.", 401);
    }

    // Preserve ?download=1
    const url = new URL(req.url);
    const qs = url.searchParams.toString();
    const upstreamUrl =
      `${core}/api/receipts/${encodeURIComponent(transactionId)}` + (qs ? `?${qs}` : "");

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          // ✅ Forward *computed* token, NOT whatever the browser sent
          Authorization: `Bearer ${accessToken}`,
        },
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