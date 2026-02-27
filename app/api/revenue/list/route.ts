import { proxyToCore } from "../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  // If your core route differs, adjust this path to match core.
  return proxyToCore(req, "/api/revenue/list");
}