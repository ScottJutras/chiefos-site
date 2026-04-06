import { type NextRequest } from "next/server";
import { proxyToCore } from "../../../_coreProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToCore(req, `/api/supplier/categories/${id}`);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToCore(req, `/api/supplier/categories/${id}`);
}
