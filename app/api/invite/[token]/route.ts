// app/api/invite/[token]/route.ts
// Proxies invite endpoints to Chief backend.
// GET  — public, no auth needed
// POST — claim, requires Supabase bearer

import { proxyToCore, proxyToCorePublic } from "../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return proxyToCorePublic(req, `/api/invite/${String(token || "").trim()}`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return proxyToCore(req, `/api/invite/${String(token || "").trim()}/claim`);
}
