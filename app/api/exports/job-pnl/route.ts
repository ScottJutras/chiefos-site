import { proxyToCore } from "../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/exports/job-pnl");
}
