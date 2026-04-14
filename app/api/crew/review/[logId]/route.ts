import { type NextRequest } from "next/server";
import { proxyToCore } from "@/app/api/_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  return proxyToCore(req, `/api/crew/review/${logId}`);
}
