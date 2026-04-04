// app/api/bulk-import/validate/route.ts
// Parse + validate a CSV upload. Does NOT write to DB.
// Accepts: multipart/form-data { file, kind } OR application/json { rows, kind }
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseExpenseRows } from "@/lib/bulk-import/parseExpenseRows";
import { parseRevenueRows } from "@/lib/bulk-import/parseRevenueRows";
import { parseTimeRows }    from "@/lib/bulk-import/parseTimeRows";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getPortalContext(req: Request) {
  const raw = req.headers.get("authorization") || "";
  const token = raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
  if (!token) return { ok: false as const, error: "Missing bearer token." };

  const admin = adminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) return { ok: false as const, error: "Invalid session." };

  const authUserId = String(authData.user.id);
  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr || !pu?.tenant_id) return { ok: false as const, error: puErr?.message || "Missing tenant." };

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", pu.tenant_id)
    .single();

  if (tenantErr || !tenant?.owner_id) return { ok: false as const, error: "Missing owner context." };

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId: String(pu.tenant_id),
    ownerId: String(tenant.owner_id),
    role: String(pu.role || ""),
  };
}

export async function POST(req: Request) {
  const ctx = await getPortalContext(req);
  if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

  const contentType = req.headers.get("content-type") || "";
  let csvText = "";
  let kind    = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    kind = String(form.get("kind") || "").trim().toLowerCase();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json(400, { ok: false, error: "No file provided." });
    }
    csvText = await (file as File).text();
  } else {
    const body = await req.json().catch(() => ({}));
    kind    = String(body.kind || "").trim().toLowerCase();
    csvText = String(body.csv || "").trim();
    if (!csvText && Array.isArray(body.rows)) {
      // Pre-split rows passed as JSON — not typical, but supported
      return json(400, { ok: false, error: "Pass raw CSV text in body.csv, not pre-split rows." });
    }
  }

  if (!["expense", "revenue", "time"].includes(kind)) {
    return json(400, { ok: false, error: "kind must be expense, revenue, or time." });
  }
  if (!csvText.trim()) {
    return json(400, { ok: false, error: "Empty file." });
  }

  if (kind === "expense") {
    const result = parseExpenseRows(csvText);
    return json(200, { ok: true, kind, valid: result.valid, invalid: result.invalid, preview_count: result.valid.length });
  }
  if (kind === "revenue") {
    const result = parseRevenueRows(csvText);
    return json(200, { ok: true, kind, valid: result.valid, invalid: result.invalid, preview_count: result.valid.length });
  }
  // time
  const result = parseTimeRows(csvText);
  return json(200, { ok: true, kind, valid: result.valid, invalid: result.invalid, preview_count: result.valid.length });
}
