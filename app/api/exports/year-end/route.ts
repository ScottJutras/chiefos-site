import { proxyToCore } from "../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/exports/year-end");
}
