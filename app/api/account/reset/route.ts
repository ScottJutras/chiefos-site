import { NextResponse, type NextRequest } from "next/server";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const token = bearerFromReq(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, code: "AUTH_REQUIRED", message: "Missing session. Please log in again." },
        { status: 401 }
      );
    }

    const core = mustEnv("CHIEF_CORE_API_BASE_URL").replace(/\/$/, "");
    const upstreamUrl = `${core}/api/account/reset`;

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const ct = upstream.headers.get("content-type") || "";
    const body = ct.includes("application/json")
      ? await upstream.json().catch(() => null)
      : await upstream.text().catch(() => null);

    return NextResponse.json(body ?? { ok: upstream.ok }, { status: upstream.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, code: "ERROR", message: e?.message || "Reset failed." },
      { status: 500 }
    );
  }
}