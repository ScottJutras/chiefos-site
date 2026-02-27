// chiefos-site/app/app/settings/billing/status/route.ts
import { NextResponse } from "next/server";

function backendBase() {
  // Prefer server-only base if present
  const v =
    String(process.env.CHIEF_CORE_API_BASE_URL || "").trim() ||
    String(process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "").trim();

  const base = v.replace(/\/+$/, "");
  if (!base) throw new Error("Missing backend base URL (CHIEF_CORE_API_BASE_URL or NEXT_PUBLIC_BACKEND_ORIGIN)");
  return base;
}

export async function GET(req: Request) {
  try {
    // Forward Authorization if present (Supabase auth mode)
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";

    const upstream = await fetch(`${backendBase()}/api/billing/status`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(auth ? { Authorization: auth } : {}),
        // cookie forwarding is optional now; keep it harmless:
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: text || "Bad JSON" };
    }

    return NextResponse.json(json, { status: upstream.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "billing_status_proxy_failed" }, { status: 500 });
  }
}