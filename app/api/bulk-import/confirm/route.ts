// app/api/bulk-import/confirm/route.ts
// Bulk-insert pre-validated rows into transactions or time_entries_v2.
// Creates an import_batches audit record, inserts rows idempotently.
import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { ParsedExpenseRow } from "@/lib/bulk-import/parseExpenseRows";
import type { ParsedRevenueRow } from "@/lib/bulk-import/parseRevenueRows";
import type { ParsedTimeRow }    from "@/lib/bulk-import/parseTimeRows";
import { parseExpenseRows } from "@/lib/bulk-import/parseExpenseRows";
import { parseRevenueRows } from "@/lib/bulk-import/parseRevenueRows";
import { parseTimeRows }    from "@/lib/bulk-import/parseTimeRows";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const revalidate = 0;

// ─── Free-tier cap ────────────────────────────────────────────────────────────

const FREE_MONTHLY_ROW_CAP = 500;

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
    .select("id, owner_id, plan")
    .eq("id", pu.tenant_id)
    .single();

  if (tenantErr || !tenant?.owner_id) return { ok: false as const, error: "Missing owner context." };

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId: String(pu.tenant_id),
    ownerId: String(tenant.owner_id),
    plan: String((tenant as any).plan || "free"),
    role: String(pu.role || ""),
  };
}

// ─── Quota check ──────────────────────────────────────────────────────────────

async function checkMonthlyQuota(
  admin: SupabaseClient,
  tenantId: string,
  plan: string,
  rowsRequested: number
): Promise<{ allowed: boolean; reason?: string }> {
  if (plan !== "free") return { allowed: true };

  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: batches } = await admin
    .from("import_batches")
    .select("row_count")
    .eq("tenant_id", tenantId)
    .gte("created_at", start);

  const used = (batches || []).reduce((sum: number, b: any) => sum + (b.row_count || 0), 0);

  if (used + rowsRequested > FREE_MONTHLY_ROW_CAP) {
    return {
      allowed: false,
      reason: `OVER_QUOTA: Free plan allows ${FREE_MONTHLY_ROW_CAP} import rows/month. Used: ${used}, requested: ${rowsRequested}.`,
    };
  }
  return { allowed: true };
}

// ─── Dedupe hash ──────────────────────────────────────────────────────────────

function txDedupeHash(ownerId: string, kind: string, date: string, amountCents: number, source: string, description: string): string {
  return createHash("sha256")
    .update([ownerId, kind, date, String(amountCents), source, description].join("|"))
    .digest("hex");
}

// ─── Job resolution ───────────────────────────────────────────────────────────

async function resolveJobId(admin: SupabaseClient, tenantId: string, jobName: string | null): Promise<string | null> {
  if (!jobName) return null;
  const { data } = await admin
    .from("jobs")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("job_name", jobName.trim())
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

// ─── Insert helpers ───────────────────────────────────────────────────────────

async function insertExpenseRows(
  admin: SupabaseClient,
  ownerId: string,
  tenantId: string,
  batchId: string,
  rows: ParsedExpenseRow[]
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0, duplicates = 0, errors = 0;

  for (const row of rows) {
    try {
      const jobId  = await resolveJobId(admin, tenantId, row.job_name);
      const source = row.vendor || "Unknown";
      const hash   = txDedupeHash(ownerId, "expense", row.date, row.amount_cents, source, row.description);

      const record: Record<string, unknown> = {
        tenant_id:       tenantId,
        owner_id:        ownerId,
        kind:            "expense",
        date:            row.date,
        amount_cents:    row.amount_cents,
        source,
        description:     row.description,
        dedupe_hash:     hash,
        import_batch_id: batchId,
      };
      if (row.category)  record.category = row.category;
      if (jobId)         record.job_id   = jobId;
      if (row.job_name)  record.job_name  = row.job_name;

      const { error, data } = await admin
        .from("transactions")
        .insert(record)
        .select("id")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") { duplicates++; }
        else { console.error("[bulk-import/confirm] expense insert error:", error.message); errors++; }
      } else if (!data) {
        duplicates++; // ON CONFLICT DO NOTHING
      } else {
        inserted++;
      }
    } catch (e: any) {
      console.error("[bulk-import/confirm] expense row exception:", e?.message);
      errors++;
    }
  }

  return { inserted, duplicates, errors };
}

async function insertRevenueRows(
  admin: SupabaseClient,
  ownerId: string,
  tenantId: string,
  batchId: string,
  rows: ParsedRevenueRow[]
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0, duplicates = 0, errors = 0;

  for (const row of rows) {
    try {
      const jobId = await resolveJobId(admin, tenantId, row.job_name);
      const hash  = txDedupeHash(ownerId, "revenue", row.date, row.amount_cents, row.source, row.description);

      const record: Record<string, unknown> = {
        tenant_id:       tenantId,
        owner_id:        ownerId,
        kind:            "revenue",
        date:            row.date,
        amount_cents:    row.amount_cents,
        source:          row.source,
        description:     row.description,
        dedupe_hash:     hash,
        import_batch_id: batchId,
      };
      if (row.category)  record.category = row.category;
      if (jobId)         record.job_id   = jobId;
      if (row.job_name)  record.job_name  = row.job_name;

      const { error, data } = await admin
        .from("transactions")
        .insert(record)
        .select("id")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") { duplicates++; }
        else { console.error("[bulk-import/confirm] revenue insert error:", error.message); errors++; }
      } else if (!data) {
        duplicates++;
      } else {
        inserted++;
      }
    } catch (e: any) {
      console.error("[bulk-import/confirm] revenue row exception:", e?.message);
      errors++;
    }
  }

  return { inserted, duplicates, errors };
}

async function insertTimeRows(
  admin: SupabaseClient,
  ownerId: string,
  tenantId: string,
  batchId: string,
  rows: ParsedTimeRow[]
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0, duplicates = 0, errors = 0;

  for (const row of rows) {
    try {
      const jobId = await resolveJobId(admin, tenantId, row.job_name);

      const record: Record<string, unknown> = {
        owner_id:        ownerId,
        user_id:         row.employee_name,
        kind:            "shift",
        start_at_utc:    row.start_at_utc,
        end_at_utc:      row.end_at_utc,
        meta:            { calc: { hours: row.hours, source: "bulk_import" } },
        created_by:      "bulk_import",
        import_batch_id: batchId,
      };
      if (jobId) record.job_id = jobId;

      // Upsert on (owner_id, user_id, start_at_utc) — same employee/shift can't be logged twice
      const { error, data } = await admin
        .from("time_entries_v2")
        .upsert(record, { onConflict: "owner_id,user_id,start_at_utc", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") { duplicates++; }
        else { console.error("[bulk-import/confirm] time insert error:", error.message); errors++; }
      } else if (!data) {
        duplicates++;
      } else {
        inserted++;
      }
    } catch (e: any) {
      console.error("[bulk-import/confirm] time row exception:", e?.message);
      errors++;
    }
  }

  return { inserted, duplicates, errors };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const ctx = await getPortalContext(req);
  if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

  const body = await req.json().catch(() => ({}));
  const kind       = String(body.kind || "").trim().toLowerCase();
  const csvText    = String(body.csv || "").trim();
  const sourceFile = String(body.source_file || "").trim() || null;

  if (!["expense", "revenue", "time"].includes(kind)) {
    return json(400, { ok: false, error: "kind must be expense, revenue, or time." });
  }
  if (!csvText) {
    return json(400, { ok: false, error: "body.csv is required." });
  }

  // Re-parse server-side for safety
  let validRows: ParsedExpenseRow[] | ParsedRevenueRow[] | ParsedTimeRow[];
  if (kind === "expense") {
    validRows = parseExpenseRows(csvText).valid;
  } else if (kind === "revenue") {
    validRows = parseRevenueRows(csvText).valid;
  } else {
    validRows = parseTimeRows(csvText).valid;
  }

  if (validRows.length === 0) {
    return json(400, { ok: false, error: "No valid rows to import." });
  }

  // Quota check
  const quota = await checkMonthlyQuota(ctx.admin, ctx.tenantId, ctx.plan, validRows.length);
  if (!quota.allowed) {
    return json(429, { ok: false, error: quota.reason, code: "OVER_QUOTA" });
  }

  // Create import batch record
  const { data: batch, error: batchErr } = await ctx.admin
    .from("import_batches")
    .insert({
      tenant_id:   ctx.tenantId,
      owner_id:    ctx.ownerId,
      kind,
      row_count:   validRows.length,
      source_file: sourceFile,
    })
    .select("id")
    .single();

  if (batchErr || !batch?.id) {
    console.error("[bulk-import/confirm] failed to create batch:", batchErr?.message);
    return json(500, { ok: false, error: "Failed to create import batch." });
  }

  const batchId = String(batch.id);

  let result: { inserted: number; duplicates: number; errors: number };

  if (kind === "expense") {
    result = await insertExpenseRows(ctx.admin, ctx.ownerId, ctx.tenantId, batchId, validRows as ParsedExpenseRow[]);
  } else if (kind === "revenue") {
    result = await insertRevenueRows(ctx.admin, ctx.ownerId, ctx.tenantId, batchId, validRows as ParsedRevenueRow[]);
  } else {
    result = await insertTimeRows(ctx.admin, ctx.ownerId, ctx.tenantId, batchId, validRows as ParsedTimeRow[]);
  }

  // Update batch row_count to actual inserted
  await ctx.admin
    .from("import_batches")
    .update({ row_count: result.inserted })
    .eq("id", batchId)
    .eq("tenant_id", ctx.tenantId);

  return json(200, {
    ok: true,
    batch_id: batchId,
    inserted:   result.inserted,
    duplicates: result.duplicates,
    errors:     result.errors,
  });
}
