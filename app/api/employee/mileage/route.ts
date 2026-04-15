import { type NextRequest } from "next/server";
import { proxyToCore } from "@/app/api/_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return proxyToCore(req, "/api/employee/mileage");
}
