// chiefos-site/app/api/billing/status/route.ts
import { NextResponse } from "next/server";

function backendBase() {
  const v = String(process.env.CHIEF_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!v) throw new Error("Missing CHIEF_API_BASE_URL");
  return v;
}

export async function GET(req: Request) {
  try {
    const upstream = await fetch(`${backendBase()}/api/billing/status`, {
      method: "GET",
      headers: {
        Accept: "application/json",
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
    return NextResponse.json(
      { error: e?.message || "billing_status_proxy_failed" },
      { status: 500 }
    );
  }
}
