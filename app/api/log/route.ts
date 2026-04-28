import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/log — owner job-detail entry write path (post-rebuild rewrite, P1 close)
//
// Replaces the pre-rebuild 503 stub (chiefos-site commit a063416) with the
// canonical write path against the rebuild schema. Five entry kinds, one
// service-role admin client, role-derived submission_status branching.
//
// FE call shape (from app/app/jobs/[jobId]/page.tsx):
//   POST /api/log
//   Authorization: Bearer <supabase access token>
//   Body: { type: "expense"|"revenue"|"hours"|"task"|"reminder", ...fields }
//
// FE sends body.type; schema column is `kind`. Translate at route boundary.
//
// Identity model (Engineering Constitution §2):
//   - tenant_id (uuid) — portal/RLS boundary
//   - owner_id  (text digits) — ingestion/audit boundary
//   - user_id   (text digits) — actor identity (owner-self == owner_id)
//
// Idempotency: source_msg_id = 'portal:' || sha256(auth_user_id + type +
//   job_id + canonical_payload + day_bucket).
// Day bucket prevents legitimate intra-day re-submission from dedup'ing
// (edit + resubmit common pattern); same exact payload on same day for same
// job dedupes (the real duplicate case).
//
// transactions has UNIQUE (owner_id, source_msg_id, kind) — ON CONFLICT DO
// NOTHING idempotency. tasks/time_entries_v2/reminders lack source_msg_id
// UNIQUE — manual SELECT-then-INSERT dedup. Tracked as
// P1B-source-msg-id-unique-on-task-time-reminder for a future P1A
// amendment to standardize.
//
// Error envelope per Engineering Constitution §9:
//   { ok: false, error: { code, message, hint, traceId } }
//
// Codes:
//   TENANT_RESOLUTION_FAILED  — auth doesn't resolve to portal user
//   JOB_NOT_FOUND             — job_id doesn't exist for tenant
//   INVALID_KIND              — body.type not in allowed set
//   VALIDATION_FAILED         — kind-specific field issues
//   IDEMPOTENCY_CONFLICT      — source_msg_id reused with different payload
//   WRITE_FAILED              — DB error during INSERT
// ─────────────────────────────────────────────────────────────────────────────

type EntryType = "expense" | "revenue" | "hours" | "task" | "reminder";
const VALID_TYPES: EntryType[] = ["expense", "revenue", "hours", "task", "reminder"];

type PortalCtx = {
  authUserId: string;        // auth.uid() uuid
  tenantId: string;          // chiefos_tenants.id uuid
  ownerId: string;           // tenant.owner_id digits
  portalUserId: string;      // chiefos_portal_users.user_id (== auth.uid())
  role: string;              // owner | board_member | employee
  userIdDigits: string | null; // public.users.user_id (digits) keyed by auth_user_id
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function adminClient() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^bearer\s+(.+)$/i);
  return (m ? m[1] : "").trim() || null;
}

function newTraceId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function jsonErr(
  status: number,
  code: string,
  message: string,
  hint: string,
  traceId: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({ ok: false, error: { code, message, hint, traceId, ...extra } }, { status });
}

// Canonical JSON for idempotency hash: sorted keys, normalized whitespace.
function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((obj as Record<string, unknown>)[k])).join(",") + "}";
}

function dayBucketUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function computeSourceMsgId(authUserId: string, type: EntryType, jobId: number | null, canonicalPayload: string): string {
  const h = crypto
    .createHash("sha256")
    .update(authUserId)
    .update("|")
    .update(type)
    .update("|")
    .update(String(jobId ?? "no_job"))
    .update("|")
    .update(canonicalPayload)
    .update("|")
    .update(dayBucketUTC())
    .digest("hex");
  return `portal:${h.slice(0, 32)}`; // 32 hex chars is plenty for collision resistance within a tenant-day
}

// Role-derived submission_status branching:
//   owner / board_member / admin → auto-approved (owner-direct entries)
//   employee / unknown            → pending_review (sent to owner per R3b)
//
// Note: transactions enum is {confirmed, pending_review, voided}; tasks +
// time_entries_v2 enum is {approved, pending_review, needs_clarification,
// rejected}. The vocabulary divergence is tracked as
// P1B-submission-status-vocabulary-normalization for a future audit
// migration. Until then, return per-table strings.
function approvedFor(table: "transactions" | "time_entries_v2" | "tasks", role: string | null): string {
  const isOwnerLike = role === "owner" || role === "board_member" || role === "admin";
  if (table === "transactions") return isOwnerLike ? "confirmed" : "pending_review";
  return isOwnerLike ? "approved" : "pending_review";
}

async function resolvePortalCtx(token: string, traceId: string): Promise<PortalCtx | NextResponse> {
  const admin = adminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    return jsonErr(401, "TENANT_RESOLUTION_FAILED", "Invalid or expired session.", "Sign in again to refresh your session.", traceId);
  }
  const authUserId = authData.user.id;

  const { data: portal, error: portalErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (portalErr || !portal?.tenant_id) {
    return jsonErr(403, "TENANT_RESOLUTION_FAILED", "Portal membership not found.", "Contact your account owner to grant portal access.", traceId);
  }

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", portal.tenant_id)
    .maybeSingle();

  if (tenantErr || !tenant?.owner_id) {
    return jsonErr(403, "TENANT_RESOLUTION_FAILED", "Tenant resolution failed.", "Tenant configuration is incomplete; contact support.", traceId);
  }

  const { data: userRow } = await admin
    .from("users")
    .select("user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return {
    authUserId,
    tenantId: tenant.id,
    ownerId: tenant.owner_id,
    portalUserId: authUserId,
    role: portal.role || "",
    userIdDigits: userRow?.user_id ?? null,
  };
}

// Verify job_id belongs to tenant. Returns true/false; sets job_no on the
// caller's row by re-pulling if needed.
async function jobBelongsToTenant(tenantId: string, jobId: number): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("jobs")
    .select("id, owner_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return false;
  // jobs.owner_id is the tenant root's digit-string; we compare via tenant lookup.
  // Cheaper: just confirm the row exists and trust RLS + tenant_id-aware portal flow.
  // For safety, we reload tenant.owner_id and compare.
  const { data: tenant } = await admin
    .from("chiefos_tenants")
    .select("owner_id")
    .eq("id", tenantId)
    .maybeSingle();
  return tenant?.owner_id === data.owner_id;
}

// ── Type-specific handlers ──────────────────────────────────────────────────

async function handleExpense(
  ctx: PortalCtx,
  body: any,
  sourceMsgId: string,
  traceId: string,
): Promise<NextResponse> {
  const amountStr = String(body?.amount ?? "").trim();
  const amountFloat = Number(amountStr);
  if (!amountStr || !Number.isFinite(amountFloat) || amountFloat <= 0) {
    return jsonErr(400, "VALIDATION_FAILED", "Amount is required and must be positive.", "Enter a numeric amount greater than 0.", traceId, { field: "amount" });
  }
  const amountCents = Math.round(amountFloat * 100);
  const date = String(body?.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const jobId = Number(body?.job_id) || null;
  if (!jobId) {
    return jsonErr(400, "VALIDATION_FAILED", "job_id is required for expense entries.", "Submit from a job context.", traceId, { field: "job_id" });
  }
  if (!(await jobBelongsToTenant(ctx.tenantId, jobId))) {
    return jsonErr(404, "JOB_NOT_FOUND", "Job not found for your tenant.", "Refresh the page; the job may have been deleted.", traceId, { job_id: jobId });
  }

  const admin = adminClient();
  const row = {
    tenant_id: ctx.tenantId,
    owner_id: ctx.ownerId,
    user_id: ctx.userIdDigits,
    kind: "expense",
    amount_cents: amountCents,
    currency: "CAD",
    date,
    description: String(body?.description ?? "").trim() || null,
    merchant: String(body?.payee ?? "").trim() || null,
    category: String(body?.category ?? "").trim() || null,
    job_id: jobId,
    job_no: Number(body?.job_no) || null,
    source: "portal" as const,
    source_msg_id: sourceMsgId,
    submission_status: approvedFor("transactions", ctx.role),
    submitted_by: ctx.userIdDigits,
  };

  const { data, error } = await admin
    .from("transactions")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return jsonErr(200, "IDEMPOTENCY_CONFLICT", "Duplicate entry detected.", "This entry was already logged today; check the expenses tab.", traceId);
    }
    return jsonErr(500, "WRITE_FAILED", error.message || "Failed to record expense.", "Try again; if the issue persists, contact support.", traceId);
  }

  return NextResponse.json({ ok: true, id: data?.id, kind: "expense", traceId }, { status: 200 });
}

async function handleRevenue(
  ctx: PortalCtx,
  body: any,
  sourceMsgId: string,
  traceId: string,
): Promise<NextResponse> {
  const amountStr = String(body?.amount ?? "").trim();
  const amountFloat = Number(amountStr);
  if (!amountStr || !Number.isFinite(amountFloat) || amountFloat <= 0) {
    return jsonErr(400, "VALIDATION_FAILED", "Amount is required and must be positive.", "Enter a numeric amount greater than 0.", traceId, { field: "amount" });
  }
  const amountCents = Math.round(amountFloat * 100);
  const date = String(body?.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const jobId = Number(body?.job_id) || null;
  if (!jobId) {
    return jsonErr(400, "VALIDATION_FAILED", "job_id is required for revenue entries.", "Submit from a job context.", traceId, { field: "job_id" });
  }
  if (!(await jobBelongsToTenant(ctx.tenantId, jobId))) {
    return jsonErr(404, "JOB_NOT_FOUND", "Job not found for your tenant.", "Refresh the page; the job may have been deleted.", traceId, { job_id: jobId });
  }

  const admin = adminClient();
  const row = {
    tenant_id: ctx.tenantId,
    owner_id: ctx.ownerId,
    user_id: ctx.userIdDigits,
    kind: "revenue",
    amount_cents: amountCents,
    currency: "CAD",
    date,
    description: String(body?.description ?? "").trim() || null,
    job_id: jobId,
    job_no: Number(body?.job_no) || null,
    source: "portal" as const,
    source_msg_id: sourceMsgId,
    submission_status: approvedFor("transactions", ctx.role),
    submitted_by: ctx.userIdDigits,
  };

  const { data, error } = await admin
    .from("transactions")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return jsonErr(200, "IDEMPOTENCY_CONFLICT", "Duplicate entry detected.", "This entry was already logged today; check the revenue tab.", traceId);
    }
    return jsonErr(500, "WRITE_FAILED", error.message || "Failed to record revenue.", "Try again; if the issue persists, contact support.", traceId);
  }

  return NextResponse.json({ ok: true, id: data?.id, kind: "revenue", traceId }, { status: 200 });
}

async function handleHours(
  ctx: PortalCtx,
  body: any,
  sourceMsgId: string,
  traceId: string,
): Promise<NextResponse> {
  const hoursStr = String(body?.hours ?? "").trim();
  const hours = Number(hoursStr);
  if (!hoursStr || !Number.isFinite(hours) || hours <= 0) {
    return jsonErr(400, "VALIDATION_FAILED", "Hours is required and must be positive.", "Enter a numeric hour count greater than 0.", traceId, { field: "hours" });
  }
  const date = String(body?.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const jobId = Number(body?.job_id) || null;
  if (!jobId) {
    return jsonErr(400, "VALIDATION_FAILED", "job_id is required for hours entries.", "Submit from a job context.", traceId, { field: "job_id" });
  }
  if (!(await jobBelongsToTenant(ctx.tenantId, jobId))) {
    return jsonErr(404, "JOB_NOT_FOUND", "Job not found for your tenant.", "Refresh the page; the job may have been deleted.", traceId, { job_id: jobId });
  }

  // Manual-hours entries don't have actual clock-in/clock-out timestamps.
  // Convention: start_at_utc = midnight UTC on entry's date; end_at_utc =
  // start + hours-as-ms. Satisfies CHECK end > start.
  const startAtUtc = new Date(`${date}T00:00:00Z`);
  const endAtUtc = new Date(startAtUtc.getTime() + Math.round(hours * 3_600_000));

  const admin = adminClient();

  // Manual SELECT-then-INSERT dedup (no source_msg_id UNIQUE on this table —
  // tracked as P1B-source-msg-id-unique-on-task-time-reminder).
  const { data: existing } = await admin
    .from("time_entries_v2")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("source_msg_id", sourceMsgId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return jsonErr(200, "IDEMPOTENCY_CONFLICT", "Duplicate entry detected.", "These hours were already logged today for this job.", traceId);
  }

  const userId = ctx.userIdDigits;
  if (!userId) {
    return jsonErr(403, "VALIDATION_FAILED", "user_id required for hours entry; portal user has no ingestion identity.", "Phone-link required to log hours.", traceId, { field: "user_id" });
  }

  const row = {
    tenant_id: ctx.tenantId,
    owner_id: ctx.ownerId,
    user_id: userId,
    kind: "shift" as const,
    job_id: jobId,
    job_no: Number(body?.job_no) || null,
    start_at_utc: startAtUtc.toISOString(),
    end_at_utc: endAtUtc.toISOString(),
    meta: {
      employee_name: String(body?.employee_name ?? "").trim() || null,
      hours_total: hoursStr,
      job_name: String(body?.job_name ?? "").trim() || null,
      entry_kind_label: "manual_hours",
    },
    created_by: ctx.userIdDigits,
    source_msg_id: sourceMsgId,
    submission_status: approvedFor("time_entries_v2", ctx.role),
  };

  const { data, error } = await admin
    .from("time_entries_v2")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    return jsonErr(500, "WRITE_FAILED", error.message || "Failed to record hours.", "Try again; if the issue persists, contact support.", traceId);
  }

  return NextResponse.json({ ok: true, id: data?.id, kind: "hours", traceId }, { status: 200 });
}

async function handleTask(
  ctx: PortalCtx,
  body: any,
  sourceMsgId: string,
  traceId: string,
): Promise<NextResponse> {
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return jsonErr(400, "VALIDATION_FAILED", "Task title is required.", "Enter a brief description (1-280 chars).", traceId, { field: "title" });
  }
  if (title.length > 280) {
    return jsonErr(400, "VALIDATION_FAILED", "Task title is too long.", "Limit title to 280 characters.", traceId, { field: "title" });
  }
  const jobId = Number(body?.job_id) || null;
  if (jobId && !(await jobBelongsToTenant(ctx.tenantId, jobId))) {
    return jsonErr(404, "JOB_NOT_FOUND", "Job not found for your tenant.", "Refresh the page; the job may have been deleted.", traceId, { job_id: jobId });
  }

  const admin = adminClient();

  // Manual SELECT-then-INSERT dedup.
  const { data: existing } = await admin
    .from("tasks")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("source_msg_id", sourceMsgId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return jsonErr(200, "IDEMPOTENCY_CONFLICT", "Duplicate task detected.", "This task was already created today.", traceId);
  }

  // task_no auto-allocation via canonical helper.
  const { data: counterRow, error: counterErr } = await admin.rpc("chiefos_next_tenant_counter", {
    p_tenant_id: ctx.tenantId,
    p_counter_kind: "task",
  });
  if (counterErr || typeof counterRow !== "number") {
    return jsonErr(500, "WRITE_FAILED", `Failed to allocate task_no: ${counterErr?.message || "no value"}`, "Try again; if the issue persists, contact support.", traceId);
  }
  const taskNo = counterRow;

  const dueAt = String(body?.due_at ?? "").trim();
  const row = {
    tenant_id: ctx.tenantId,
    owner_id: ctx.ownerId,
    task_no: taskNo,
    title,
    body: String(body?.notes ?? "").trim() || null,
    status: "open" as const,
    kind: "general" as const,
    job_id: jobId,
    job_no: Number(body?.job_no) || null,
    created_by_portal_user_id: ctx.portalUserId,
    created_by_user_id: ctx.userIdDigits,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    source: "portal" as const,
    source_msg_id: sourceMsgId,
    submission_status: approvedFor("tasks", ctx.role),
  };

  const { data, error } = await admin
    .from("tasks")
    .insert(row)
    .select("id, task_no")
    .maybeSingle();

  if (error) {
    return jsonErr(500, "WRITE_FAILED", error.message || "Failed to create task.", "Try again; if the issue persists, contact support.", traceId);
  }

  return NextResponse.json({ ok: true, id: data?.id, task_no: data?.task_no, kind: "task", traceId }, { status: 200 });
}

async function handleReminder(
  ctx: PortalCtx,
  body: any,
  sourceMsgId: string,
  traceId: string,
): Promise<NextResponse> {
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return jsonErr(400, "VALIDATION_FAILED", "Reminder title is required.", "Enter a brief description.", traceId, { field: "title" });
  }
  const remindAtRaw = String(body?.remind_at ?? "").trim();
  if (!remindAtRaw) {
    return jsonErr(400, "VALIDATION_FAILED", "remind_at is required.", "Pick a date/time for the reminder.", traceId, { field: "remind_at" });
  }
  const dueAt = new Date(remindAtRaw);
  if (Number.isNaN(dueAt.getTime())) {
    return jsonErr(400, "VALIDATION_FAILED", "remind_at is not a valid date.", "Use a standard datetime format.", traceId, { field: "remind_at" });
  }

  const admin = adminClient();

  // Manual SELECT-then-INSERT dedup.
  const { data: existing } = await admin
    .from("reminders")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("source_msg_id", sourceMsgId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return jsonErr(200, "IDEMPOTENCY_CONFLICT", "Duplicate reminder detected.", "This reminder was already set today.", traceId);
  }

  const row = {
    tenant_id: ctx.tenantId,
    owner_id: ctx.ownerId,
    user_id: ctx.userIdDigits,
    kind: "custom" as const,
    due_at: dueAt.toISOString(),
    payload: { title, source: "portal_log_route" },
    source_msg_id: sourceMsgId,
  };

  const { data, error } = await admin
    .from("reminders")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    return jsonErr(500, "WRITE_FAILED", error.message || "Failed to set reminder.", "Try again; if the issue persists, contact support.", traceId);
  }

  return NextResponse.json({ ok: true, id: data?.id, kind: "reminder", traceId }, { status: 200 });
}

// ── Route entry ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const traceId = newTraceId();
  try {
    const token = bearer(req);
    if (!token) {
      return jsonErr(401, "TENANT_RESOLUTION_FAILED", "Missing authorization bearer token.", "Sign in and retry.", traceId);
    }

    const body = await req.json().catch(() => ({}));
    const type = String(body?.type ?? "").trim().toLowerCase() as EntryType;
    if (!VALID_TYPES.includes(type)) {
      return jsonErr(400, "INVALID_KIND", `Unknown entry type "${type}".`, `Use one of: ${VALID_TYPES.join(", ")}.`, traceId);
    }

    const ctxOrErr = await resolvePortalCtx(token, traceId);
    if (ctxOrErr instanceof NextResponse) return ctxOrErr;
    const ctx = ctxOrErr;

    // Idempotency hash from authUserId + type + jobId + canonical payload + day bucket.
    // Day bucket allows legitimate intra-day re-submission with edits while
    // dedup'ing exact-payload duplicates.
    const jobIdForHash = Number(body?.job_id) || null;
    const canonicalPayload = canonicalize(
      Object.fromEntries(
        Object.entries(body || {}).filter(([k]) => k !== "type" && k !== "job_no" && k !== "job_name"),
      ),
    );
    const sourceMsgId = computeSourceMsgId(ctx.authUserId, type, jobIdForHash, canonicalPayload);

    switch (type) {
      case "expense":  return await handleExpense(ctx, body, sourceMsgId, traceId);
      case "revenue":  return await handleRevenue(ctx, body, sourceMsgId, traceId);
      case "hours":    return await handleHours(ctx, body, sourceMsgId, traceId);
      case "task":     return await handleTask(ctx, body, sourceMsgId, traceId);
      case "reminder": return await handleReminder(ctx, body, sourceMsgId, traceId);
      default:
        return jsonErr(400, "INVALID_KIND", `Unknown entry type "${type}".`, `Use one of: ${VALID_TYPES.join(", ")}.`, traceId);
    }
  } catch (e: any) {
    return jsonErr(500, "WRITE_FAILED", e?.message || "Unexpected /api/log error.", "Try again; if the issue persists, contact support.", traceId);
  }
}
