import { proxyToCore } from "../../../../_coreProxy";
import { type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

export async function GET(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  return proxyToCore(req, `/api/customers/${customerId}/notes`);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  return proxyToCore(req, `/api/customers/${customerId}/notes`);
}
