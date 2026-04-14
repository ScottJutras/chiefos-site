import { proxyToCore } from "../../../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = String(params.id || "").trim();
  return proxyToCore(req, `/api/crew/review/expenses/${id}`);
}
