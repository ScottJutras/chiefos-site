import { type NextRequest } from "next/server";
import { proxyToCore } from "../../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return proxyToCore(req, `/api/catalog/suppliers/${slug}`);
}
