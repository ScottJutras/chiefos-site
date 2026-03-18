// chiefos-site/app/app/settings/billing/checkout/route.ts
import { NextResponse } from "next/server";

function backendBase() {
  const v = String(process.env.CHIEF_CORE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!v) throw new Error("Missing CHIEF_CORE_API_BASE_URL");
  return v;
}

function bearerFromReq(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export async function POST(req: Request) {
  try {
    const token = bearerFromReq(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing session. Please log in again." },
        { status: 401 }
      );
    }

    const body = await req.text(); // forward raw JSON

    const upstream = await fetch(`${backendBase()}/api/billing/checkout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
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
    return NextResponse.json(
      { error: e?.message || "billing_checkout_proxy_failed" },
      { status: 500 }
    );
  }
}
