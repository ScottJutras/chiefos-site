import { proxyToCore } from "../../../../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ customerId: string; noteId: string }> }) {
  const { customerId, noteId } = await params;
  return proxyToCore(req, `/api/customers/${customerId}/notes/${noteId}`);
}
