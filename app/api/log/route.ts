import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(n: string) {
  const v = process.env[n];
  if (!v) throw new Error(`Missing ${n}`);
  return v;
}

function bearer(req: Request) {
  const raw = req.headers.get("authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function admin() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function ctx(req: Request) {
  const token = bearer(req);
  if (!token) return { ok: false as const, error: "Missing token" };
  const db = admin();
  const { data: au } = await db.auth.getUser(token);
  if (!au?.user?.id) return { ok: false as const, error: "Invalid session" };
  const { data: pu } = await db
    .from("chiefos_portal_users")
    .select("tenant_id")
    .eq("user_id", au.user.id)
    .maybeSingle();
  if (!pu?.tenant_id) return { ok: false as const, error: "No tenant" };
  // Resolve actor phone for legacy owner_id tables
  const { data: actor } = await db
    .from("chiefos_tenant_actor_profiles")
    .select("phone_digits, display_name")
    .eq("tenant_id", pu.tenant_id)
    .maybeSingle();
  return {
    ok: true as const,
    db,
    tenantId: String(pu.tenant_id),
    userId: String(au.user.id),
    ownerId: actor?.phone_digits ? `+${actor.phone_digits}` : null,
    displayName: actor?.display_name || null,
  };
}

export async function POST(req: Request) {
  try {
    const c = await ctx(req);
    if (!c.ok) return NextResponse.json({ ok: false, error: c.error }, { status: 401 });

    const body = await req.json();
    const { type } = body;

    if (type === "expense" || type === "revenue") {
      const amountCents = Math.round(parseFloat(body.amount || "0") * 100);
      if (!amountCents || amountCents <= 0)
        return NextResponse.json({ ok: false, error: "Enter a valid amount." }, { status: 400 });

      const { error } = await c.db.from("transactions").insert({
        tenant_id:        c.tenantId,
        owner_id:         c.ownerId,
        kind:             type,
        amount_cents:     amountCents,
        amount:           amountCents / 100,
        date:             body.date || new Date().toISOString().slice(0, 10),
        description:      body.description?.trim() || null,
        payee_name:       body.payee?.trim() || null,
        job_name:         body.job_name?.trim() || null,
        job_id:           body.job_id || null,
        expense_category: body.category?.trim() || null,
        source:           "portal",
        user_name:        c.displayName,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (type === "hours") {
      if (!body.hours || parseFloat(body.hours) <= 0)
        return NextResponse.json({ ok: false, error: "Enter valid hours." }, { status: 400 });
      const date    = body.date || new Date().toISOString().slice(0, 10);
      const hours   = parseFloat(body.hours);
      const clockIn = new Date(`${date}T08:00:00`);
      const clockOut = new Date(clockIn.getTime() + hours * 3600 * 1000);

      const { error } = await c.db.from("time_entries").insert([
        {
          tenant_id:     c.tenantId,
          owner_id:      c.ownerId,
          employee_name: body.employee_name?.trim() || c.displayName || "Owner",
          type:          "clock_in",
          timestamp:     clockIn.toISOString(),
          local_time:    clockIn.toISOString(),
          job_name:      body.job_name?.trim() || null,
          job_no:        body.job_no || null,
          source_msg_id: `portal_${Date.now()}_in`,
        },
        {
          tenant_id:     c.tenantId,
          owner_id:      c.ownerId,
          employee_name: body.employee_name?.trim() || c.displayName || "Owner",
          type:          "clock_out",
          timestamp:     clockOut.toISOString(),
          local_time:    clockOut.toISOString(),
          job_name:      body.job_name?.trim() || null,
          job_no:        body.job_no || null,
          source_msg_id: `portal_${Date.now()}_out`,
        },
      ]);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (type === "task") {
      if (!body.title?.trim())
        return NextResponse.json({ ok: false, error: "Title required." }, { status: 400 });
      const { error } = await c.db.from("tasks").insert({
        owner_id:  c.ownerId,
        created_by: c.ownerId,
        title:     body.title.trim(),
        body:      body.notes?.trim() || null,
        status:    "pending",
        due_at:    body.due_at || null,
        job_no:    body.job_no || null,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (type === "reminder") {
      if (!body.title?.trim())
        return NextResponse.json({ ok: false, error: "Title required." }, { status: 400 });
      if (!body.remind_at)
        return NextResponse.json({ ok: false, error: "Remind date/time required." }, { status: 400 });
      const { error } = await c.db.from("reminders").insert({
        owner_id:  c.ownerId,
        user_id:   c.userId,
        title:     body.title.trim(),
        remind_at: body.remind_at,
        status:    "pending",
        kind:      "manual",
        sent:      false,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: `Unknown type: ${type}` }, { status: 400 });
  } catch (e: any) {
    console.error("[log]", e?.message);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
