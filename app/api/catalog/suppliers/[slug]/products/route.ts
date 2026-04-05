import { type NextRequest } from "next/server";
import { proxyToCore } from "../../../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const search = req.nextUrl.searchParams.toString();
  const qs = search ? `?${search}` : "";
  return proxyToCore(req, `/api/catalog/suppliers/${slug}/products${qs}`);
}
