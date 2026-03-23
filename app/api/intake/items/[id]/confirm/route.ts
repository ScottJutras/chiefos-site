import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function bearerFromReq(req: Request) {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

function adminClient() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

async function getPortalContext(req: Request) {
  const token = bearerFromReq(req);
  if (!token) return { ok: false as const, error: "Missing bearer token." };

  const admin = adminClient();

  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    return { ok: false as const, error: "Invalid session." };
  }

  const authUserId = String(authData.user.id);

  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr) return { ok: false as const, error: puErr.message || "Failed to resolve membership." };
  if (!pu?.tenant_id) return { ok: false as const, error: "Missing tenant context." };

  const tenantId = String(pu.tenant_id);
  const role = String(pu.role || "");

  const { data: tenant, error: tenantErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", tenantId)
    .single();

  if (tenantErr || !tenant?.owner_id) {
    return { ok: false as const, error: tenantErr?.message || "Missing owner context." };
  }

  return {
    ok: true as const,
    admin,
    authUserId,
    tenantId,
    ownerId: String(tenant.owner_id),
    role,
  };
}

function toNullableText(x: any) {
  const s = String(x ?? "").trim();
  return s ? s : null;
}

function toNullableDate(x: any) {
  const s = String(x ?? "").trim();
  return s ? s : null;
}

function toAmountCents(x: any) {
  if (x == null || x === "") return null;
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function buildExpenseDescription(payload: {
  vendor?: string | null;
  description?: string | null;
}) {
  const vendor = String(payload.vendor || "").trim();
  const description = String(payload.description || "").trim();

  if (description) return description;
  if (vendor) return `Expense from ${vendor}`;
  return "Expense";
}

function escapeIlike(value: string) {
  // Escape LIKE special chars, then strip PostgREST filter-syntax chars (comma splits conditions)
  return value.replace(/[%_]/g, "\\$&").replace(/[,()]/g, "");
}

function normalizeFlags(flags: any): string[] {
  if (Array.isArray(flags)) return flags.map((x) => String(x || "").trim()).filter(Boolean);
  return [];
}

function hasBlockingFlags(flags: string[]) {
  const blocking = new Set([
    "possible_duplicate_attachment",
    "possible_duplicate_content",
    "unsupported_file_type",
  ]);
  return flags.some((flag) => blocking.has(String(flag || "")));
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    const admin = ctx.admin;

    if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "board")) {
      return json(403, {
        ok: false,
        error: "Owner-only or approver-only action.",
        code: "PERMISSION_DENIED",
      });
    }

    const params = await context.params;
    const itemId = String(params.id || "").trim();
    if (!itemId) return json(400, { ok: false, error: "Missing item id." });

    const body = await req.json().catch(() => ({}));

    const { data: item, error: itemErr } = await admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId)
      .single();

    if (itemErr || !item) {
      return json(404, { ok: false, error: itemErr?.message || "Intake item not found." });
    }

    const currentStatus = String(item.status || "").trim();
    if (["persisted", "confirmed"].includes(currentStatus)) {
      return json(409, {
        ok: false,
        error: "This intake item has already been confirmed.",
      });
    }

    if (["duplicate", "skipped", "failed"].includes(currentStatus)) {
      return json(409, {
        ok: false,
        error: `This intake item cannot be confirmed from status "${currentStatus}".`,
      });
    }

    const { data: existingDraft, error: draftErr } = await admin
      .from("intake_item_drafts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("intake_item_id", itemId)
      .limit(1)
      .maybeSingle();

    if (draftErr) {
      return json(500, { ok: false, error: draftErr.message || "Failed to load draft." });
    }

    const existingFlags = normalizeFlags(existingDraft?.validation_flags);
    if (hasBlockingFlags(existingFlags)) {
      return json(409, {
        ok: false,
        error: "This item has blocking review flags and cannot be confirmed until resolved.",
      });
    }

    const beforePayload = {
      item,
      draft: existingDraft || null,
    };

    const draftType = String(body?.draftType || existingDraft?.draft_type || item?.draft_type || "expense");
    if (draftType !== "expense") {
      return json(400, {
        ok: false,
        error: "Phase 2 confirm currently supports expense drafts only.",
      });
    }

    const amountCents = toAmountCents(body?.amountCents ?? existingDraft?.amount_cents);
    if (amountCents == null || amountCents <= 0) {
      return json(400, { ok: false, error: "A valid amount is required." });
    }

    const vendor = toNullableText(body?.vendor ?? existingDraft?.vendor);
    const description = toNullableText(body?.description ?? existingDraft?.description);
    const eventDate = toNullableDate(body?.eventDate ?? existingDraft?.event_date);
    const expenseCategory = toNullableText(body?.expenseCategory ?? existingDraft?.expense_category);
    const isPersonal = body?.isPersonal === true || body?.isPersonal === "true" || false;

    if (!eventDate) {
      return json(400, { ok: false, error: "A valid date is required." });
    }

    const providedJobName = toNullableText(body?.jobName ?? existingDraft?.job_name ?? item?.job_name);
    if (!providedJobName) {
      return json(400, {
        ok: false,
        error: "Job is required before confirming this draft.",
      });
    }

    const currency = toNullableText(body?.currency ?? existingDraft?.currency) || "USD";

    const escapedJobName = escapeIlike(providedJobName);
    const likeToken = `%${escapedJobName}%`;

    let resolvedJobName: string | null = null;
    let resolvedJobId: number | null = null;

    const { data: exactJob, error: exactJobErr } = await admin
      .from("jobs")
      .select("id, job_name, name, job_no, status")
      .eq("owner_id", ctx.ownerId)
      .or(`job_name.ilike.${likeToken},name.ilike.${likeToken}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (exactJobErr) {
      return json(500, {
        ok: false,
        error: exactJobErr.message || "Failed to resolve job.",
      });
    }

    const jobCandidates = Array.isArray(exactJob) ? exactJob : [];

    if (jobCandidates.length === 0) {
      return json(400, {
        ok: false,
        error: "Select a valid existing job before confirming this draft.",
      });
    }

    if (jobCandidates.length > 1) {
      const exactNameMatches = jobCandidates.filter((row: any) => {
        const a = String(row?.job_name || row?.name || "").trim().toLowerCase();
        const b = providedJobName.trim().toLowerCase();
        return a === b;
      });

      if (exactNameMatches.length === 1) {
        const row: any = exactNameMatches[0];
        resolvedJobId = Number(row?.id || 0) || null;
        resolvedJobName = String(row?.job_name || row?.name || providedJobName).trim() || providedJobName;
      } else {
        return json(409, {
          ok: false,
          error: "Job is still ambiguous. Pick one job from the suggested list before confirming.",
        });
      }
    } else {
      const row: any = jobCandidates[0];
      resolvedJobId = Number(row?.id || 0) || null;
      resolvedJobName = String(row?.job_name || row?.name || providedJobName).trim() || providedJobName;
    }

    if (!resolvedJobName || resolvedJobId == null) {
      return json(400, {
        ok: false,
        error: "A valid job is required before confirming this draft.",
      });
    }

    const txDescription = buildExpenseDescription({
      vendor,
      description,
    });

    // ----------------------------------------------------
    // Interim bridge:
    // This still writes to canonical transactions directly.
    // Long-term this should call a domain mutation surface.
    // ----------------------------------------------------
    const transactionInsert: Record<string, any> = {
      tenant_id: ctx.tenantId,
      owner_id: ctx.ownerId,
      kind: "expense",
      amount_cents: amountCents,
      currency,
      date: eventDate,
      description: txDescription,
      source: vendor || "upload",
      source_msg_id: item.source_msg_id || item.id,
      created_at: new Date().toISOString(),
      job_name: resolvedJobName,
      expense_category: expenseCategory || null,
      is_personal: isPersonal,
    };

    // Keep the current schema assumption used in your project.
    transactionInsert.job_id = resolvedJobId;

    const { data: tx, error: txErr } = await admin
      .from("transactions")
      .insert(transactionInsert)
      .select("id")
      .single();

    if (txErr || !tx?.id) {
      return json(500, {
        ok: false,
        error: txErr?.message || "Failed to create canonical expense.",
      });
    }

    const nextDraftPayload = {
      draft_type: "expense",
      amount_cents: amountCents,
      currency,
      vendor,
      description,
      event_date: eventDate,
      job_name: resolvedJobName,
      job_int_id: resolvedJobId,
      expense_category: expenseCategory || null,
      is_personal: isPersonal,
      raw_model_output: existingDraft?.raw_model_output || {},
      validation_flags: [],
      updated_at: new Date().toISOString(),
    };

    if (existingDraft?.id) {
      const { error: updDraftErr } = await admin
        .from("intake_item_drafts")
        .update(nextDraftPayload)
        .eq("tenant_id", ctx.tenantId)
        .eq("id", existingDraft.id);

      if (updDraftErr) {
        return json(500, { ok: false, error: updDraftErr.message || "Failed to update draft." });
      }
    } else {
      const { error: insDraftErr } = await admin
        .from("intake_item_drafts")
        .insert({
          intake_item_id: itemId,
          tenant_id: ctx.tenantId,
          owner_id: ctx.ownerId,
          ...nextDraftPayload,
          created_at: new Date().toISOString(),
        });

      if (insDraftErr) {
        return json(500, { ok: false, error: insDraftErr.message || "Failed to create draft." });
      }
    }

    const { error: itemUpdErr } = await admin
      .from("intake_items")
      .update({
        status: "persisted",
        draft_type: "expense",
        job_name: resolvedJobName,
        job_int_id: resolvedJobId,
        confidence_score: item.confidence_score,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", itemId);

    if (itemUpdErr) {
      return json(500, { ok: false, error: itemUpdErr.message || "Failed to update intake item." });
    }

    const afterPayload = {
      transaction_id: tx.id,
      amount_cents: amountCents,
      currency,
      vendor,
      description,
      event_date: eventDate,
      job_name: resolvedJobName,
      job_int_id: resolvedJobId,
    };

    const { error: reviewErr } = await admin
      .from("intake_item_reviews")
      .insert({
        intake_item_id: itemId,
        tenant_id: ctx.tenantId,
        owner_id: ctx.ownerId,
        reviewed_by_auth_user_id: ctx.authUserId,
        action: body?.edited ? "edit_confirm" : "confirm",
        before_payload: beforePayload,
        after_payload: afterPayload,
        comment: toNullableText(body?.comment),
        created_at: new Date().toISOString(),
      });

    if (reviewErr) {
      return json(500, { ok: false, error: reviewErr.message || "Failed to create review log." });
    }

    if (item.batch_id) {
      const { data: batchItems, error: batchItemsErr } = await admin
        .from("intake_items")
        .select("id,status")
        .eq("tenant_id", ctx.tenantId)
        .eq("batch_id", item.batch_id);

      if (batchItemsErr) {
        return json(500, {
          ok: false,
          error: batchItemsErr.message || "Failed to update batch progress.",
        });
      }

      const confirmedItems = (batchItems || []).filter((r) =>
        ["confirmed", "persisted"].includes(String(r.status || ""))
      ).length;
      const skippedItems = (batchItems || []).filter((r) => String(r.status || "") === "skipped").length;
      const duplicateItems = (batchItems || []).filter((r) => String(r.status || "") === "duplicate").length;

      const batchComplete =
        (batchItems || []).length > 0 &&
        (batchItems || []).every((r) =>
          ["persisted", "skipped", "duplicate", "failed"].includes(String(r.status || ""))
        );

      const { error: batchUpdErr } = await admin
        .from("intake_batches")
        .update({
          confirmed_items: confirmedItems,
          skipped_items: skippedItems,
          duplicate_items: duplicateItems,
          status: batchComplete ? "completed" : "pending_review",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", item.batch_id);

      if (batchUpdErr) {
        return json(500, {
          ok: false,
          error: batchUpdErr.message || "Failed to update intake batch.",
        });
      }
    }

    return json(200, {
      ok: true,
      intakeItemId: itemId,
      transactionId: tx.id,
      status: "persisted",
      jobName: resolvedJobName,
      jobId: resolvedJobId,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Confirm failed." });
  }
}