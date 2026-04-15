import { type NextRequest } from "next/server";
import { proxyToCore } from "@/app/api/_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ actorId: string }> }
) {
  const { actorId } = await params;
  return proxyToCore(req, `/api/crew/admin/members/${actorId}`);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ actorId: string }> }
) {
  const { actorId } = await params;
  return proxyToCore(req, `/api/crew/admin/members/${actorId}`);
}
