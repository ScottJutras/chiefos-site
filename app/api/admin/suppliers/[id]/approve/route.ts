import { type NextRequest } from "next/server";
import { proxyToCore } from "../../../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToCore(req, `/api/admin/suppliers/${id}/approve`);
}
