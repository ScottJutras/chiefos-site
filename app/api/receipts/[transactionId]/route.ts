// app/api/receipts/[transactionId]/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function jsonErr(code: string, message: string, status = 200, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, code, message, ...(extra || {}) }, { status });
}

export async function GET(req: Request, ctx: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await ctx.params;
    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");

    // Preserve ?download=1 etc.
    const url = new URL(req.url);
    const qs = url.searchParams.toString();
    const upstreamUrl = `${core}/api/receipts/${encodeURIComponent(transactionId)}${qs ? `?${qs}` : ""}`;

    // Forward cookies to core (dashboard auth)
    const h = await headers();
    const cookie = h.get("cookie") || "";

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          cookie, // ✅ forwards dashboard cookie token
        },
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

    if (ct.includes("application/json")) {
      const j = await upstream.json().catch(() => null);
      return NextResponse.json(j ?? { ok: false, code: "ERROR", message: "Receipt failed." }, { status: upstream.status });
    }

    // Stream binary through
    const outHeaders = new Headers();
    const pass = (name: string) => {
      const v = upstream.headers.get(name);
      if (v) outHeaders.set(name, v);
    };
    pass("content-type");
    pass("content-disposition");
    pass("cache-control");

    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  } catch (e: any) {
    return jsonErr("ERROR", e?.message || "Receipt failed.", 500);
  }
}