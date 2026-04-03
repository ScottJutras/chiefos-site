import { proxyToCore } from "../../../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ jobId: string; phaseId: string }> }) {
  const { jobId, phaseId } = await params;
  return proxyToCore(req, `/api/jobs/${jobId}/phases/${phaseId}`);
}
