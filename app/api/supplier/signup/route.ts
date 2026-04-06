import { type NextRequest } from "next/server";
import { proxyToCorePublic } from "../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public route — no session required at signup time
export async function POST(req: NextRequest) {
  return proxyToCorePublic(req, "/api/supplier/signup");
}
