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

    const { reminder_id, action } = await req.json();
    if (!reminder_id || !["confirm", "skip"].includes(action)) {
      return NextResponse.json({ ok: false, error: "reminder_id and action (confirm|skip) required" }, { status: 400 });
    }

    const { data: reminder, error: remErr } = await ctx.admin
      .from("overhead_reminders")
      .select("*")
      .eq("id", reminder_id)
      .eq("tenant_id", ctx.tenantId)
      .single();

    if (remErr || !reminder) return NextResponse.json({ ok: false, error: "Reminder not found." }, { status: 404 });

    const newStatus = action === "confirm" ? "confirmed" : "skipped";

    await ctx.admin
      .from("overhead_reminders")
      .update({ status: newStatus })
      .eq("id", reminder_id);

    if (action === "confirm") {
      const now = new Date();
      await ctx.admin.from("overhead_payments").upsert({
        tenant_id:        ctx.tenantId,
        item_id:          reminder.item_id,
        period_year:      reminder.period_year,
        period_month:     reminder.period_month,
        paid_date:        now.toISOString().slice(0, 10),
        amount_cents:     reminder.amount_cents,
        tax_amount_cents: reminder.tax_amount_cents ?? null,
        source:           "review",
        confirmed_at:     now.toISOString(),
      }, { onConflict: "item_id,period_year,period_month" });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[confirm-reminder]", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
