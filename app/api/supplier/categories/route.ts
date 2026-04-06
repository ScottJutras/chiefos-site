import { type NextRequest } from "next/server";
import { proxyToCore } from "../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToCore(req, "/api/supplier/categories");
}

export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/supplier/categories");
}
