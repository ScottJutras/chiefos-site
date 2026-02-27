import { proxyToCore } from "../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/link-phone/verify");
}