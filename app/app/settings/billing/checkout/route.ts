// chiefos-site/app/api/billing/checkout/route.ts
import { NextResponse } from "next/server";

function backendBase() {
  const v = String(process.env.CHIEF_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!v) throw new Error("Missing CHIEF_API_BASE_URL");
  return v;
}

export async function POST(req: Request) {
  try {
    const body = await req.text(); // forward raw JSON

    const upstream = await fetch(`${backendBase()}/api/billing/checkout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") || "",
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
