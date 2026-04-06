import { type NextRequest } from "next/server";
import { proxyToCore } from "../../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  const qs = search ? `?${search}` : "";
  return proxyToCore(req, `/api/supplier/products${qs}`);
}

export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/supplier/products");
}
