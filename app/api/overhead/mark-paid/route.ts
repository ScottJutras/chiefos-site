import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const raw = req.headers.get("authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function adminClient() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getTenantContext(req: Request) {
  const token = bearerFromReq(req);
  if (!token) return { ok: false as const, error: "Missing bearer token." };
  const admin = adminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) return { ok: false as const, error: "Invalid session." };
  const { data: pu } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!pu?.tenant_id) return { ok: false as const, error: "Missing tenant." };
  return { ok: true as const, admin, tenantId: String(pu.tenant_id) };
}

export async function POST(req: Request) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.error }, { status: 401 });

    const { item_id } = await req.json();
    if (!item_id) return NextResponse.json({ ok: false, error: "item_id required" }, { status: 400 });

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    const { data: item, error: itemErr } = await ctx.admin
      .from("overhead_items")
      .select("id, tenant_id, amount_cents, tax_amount_cents")
      .eq("id", item_id)
      .eq("tenant_id", ctx.tenantId)
      .single();

    if (itemErr || !item) return NextResponse.json({ ok: false, error: "Item not found." }, { status: 404 });

    const { error } = await ctx.admin.from("overhead_payments").upsert({
      tenant_id:        ctx.tenantId,
      item_id,
      period_year:      year,
      period_month:     month,
      paid_date:        now.toISOString().slice(0, 10),
      amount_cents:     item.amount_cents,
      tax_amount_cents: item.tax_amount_cents ?? null,
      source:           "manual",
      confirmed_at:     now.toISOString(),
    }, { onConflict: "item_id,period_year,period_month" });

    if (error) throw error;

    // Resolve any pending reminder for this period
    await ctx.admin.from("overhead_reminders")
      .update({ status: "confirmed" })
      .eq("item_id", item_id)
      .eq("period_year", year)
      .eq("period_month", month)
      .eq("status", "pending");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[mark-paid]", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
