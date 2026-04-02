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
    const force = body?.force === true;
    if (!force && hasBlockingFlags(existingFlags)) {
      return json(409, {
        ok: false,
        error: "This item may be a duplicate. Review your existing records, then confirm anyway if it's new.",
        code: "BLOCKING_FLAGS",
        flags: existingFlags,
      });
    }

    const beforePayload = {
      item,
      draft: existingDraft || null,
    };

    const draftType = String(body?.draftType || existingDraft?.draft_type || item?.draft_type || "expense");
    const supportedTypes = ["expense", "overhead", "revenue", "lead", "quote", "change_order", "invoice"];
    if (!supportedTypes.includes(draftType)) {
      return json(400, {
        ok: false,
        error: `Draft type "${draftType}" is not yet supported for confirm.`,
      });
    }

    // ── Overhead confirm ────────────────────────────────────────────────────────
    if (draftType === "overhead") {
      const amountCents = toAmountCents(body?.amountCents ?? existingDraft?.amount_cents);
      if (amountCents == null || amountCents <= 0) {
        return json(400, { ok: false, error: "A valid amount is required." });
      }

      const overheadCtx = (existingDraft?.raw_model_output as any)?.overhead_context || {};
      const name = toNullableText(body?.name ?? body?.vendor ?? existingDraft?.vendor ?? overheadCtx?.name) || "Fixed Overhead";
      const category = toNullableText(body?.category ?? overheadCtx?.category) || "other";
      const frequency = toNullableText(body?.frequency ?? overheadCtx?.frequency) || "monthly";
      const rawDueDay = body?.dueDay != null ? Number(body.dueDay) : (overheadCtx?.due_day ?? null);
      const dueDay = rawDueDay != null && rawDueDay >= 1 && rawDueDay <= 28 ? rawDueDay : null;
      const notes = toNullableText(body?.notes ?? existingDraft?.description);

      const { data: overheadItem, error: overheadErr } = await admin
        .from("overhead_items")
        .insert({
          tenant_id: ctx.tenantId,
          name,
          category,
          item_type: "recurring",
          amount_cents: amountCents,
          frequency,
          due_day: dueDay,
          notes: notes || null,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (overheadErr || !overheadItem?.id) {
        return json(500, { ok: false, error: overheadErr?.message || "Failed to create overhead item." });
      }

      // Update draft
      const overheadDraftPayload = {
        draft_type: "overhead",
        amount_cents: amountCents,
        vendor: name,
        description: notes || null,
        raw_model_output: existingDraft?.raw_model_output || {},
        validation_flags: [],
        updated_at: new Date().toISOString(),
      };

      if (existingDraft?.id) {
        await admin.from("intake_item_drafts").update(overheadDraftPayload).eq("tenant_id", ctx.tenantId).eq("id", existingDraft.id);
      } else {
        await admin.from("intake_item_drafts").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, ...overheadDraftPayload, created_at: new Date().toISOString() });
      }

      await admin.from("intake_items").update({ status: "persisted", draft_type: "overhead", confidence_score: item.confidence_score, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId).eq("id", itemId);

      await admin.from("intake_item_reviews").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, reviewed_by_auth_user_id: ctx.authUserId, action: "confirm", before_payload: beforePayload, after_payload: { overhead_item_id: overheadItem.id, name, category, frequency, amount_cents: amountCents, due_day: dueDay }, created_at: new Date().toISOString() });

      return json(200, { ok: true, intakeItemId: itemId, overheadItemId: overheadItem.id, status: "persisted" });
    }

    // ── Revenue confirm ─────────────────────────────────────────────────────────
    if (draftType === "revenue") {
      const amountCents = toAmountCents(body?.amountCents ?? existingDraft?.amount_cents);
      if (amountCents == null || amountCents <= 0) {
        return json(400, { ok: false, error: "A valid amount is required." });
      }
      const eventDate = toNullableDate(body?.eventDate ?? existingDraft?.event_date);
      if (!eventDate) {
        return json(400, { ok: false, error: "A valid date is required." });
      }
      const vendor = toNullableText(body?.vendor ?? existingDraft?.vendor);
      const description = toNullableText(body?.description ?? existingDraft?.description) || (vendor ? `Revenue from ${vendor}` : "Revenue");
      const currency = toNullableText(body?.currency ?? existingDraft?.currency) || "USD";
      const providedJobName = toNullableText(body?.jobName ?? existingDraft?.job_name ?? item?.job_name);

      let resolvedJobName: string | null = null;
      let resolvedJobId: number | null = null;

      if (providedJobName) {
        const likeToken = `%${escapeIlike(providedJobName)}%`;
        const { data: jobRows } = await admin.from("jobs").select("id, job_name, name").eq("owner_id", ctx.ownerId).or(`job_name.ilike.${likeToken},name.ilike.${likeToken}`).limit(3);
        const job = (jobRows as any[])?.[0];
        if (job) {
          resolvedJobId = Number(job.id);
          resolvedJobName = String(job.job_name || job.name || providedJobName);
        } else {
          resolvedJobName = providedJobName;
        }
      }

      const { data: revTx, error: revErr } = await admin.from("transactions").insert({ tenant_id: ctx.tenantId, owner_id: ctx.ownerId, kind: "revenue", amount_cents: amountCents, currency, date: eventDate, description, source: vendor || "upload", source_msg_id: item.source_msg_id || item.id, created_at: new Date().toISOString(), job_name: resolvedJobName, job_id: resolvedJobId }).select("id").single();

      if (revErr || !revTx?.id) {
        return json(500, { ok: false, error: revErr?.message || "Failed to create revenue record." });
      }

      const revDraftPayload = { draft_type: "revenue", amount_cents: amountCents, currency, vendor, description, event_date: eventDate, job_name: resolvedJobName, job_int_id: resolvedJobId, raw_model_output: existingDraft?.raw_model_output || {}, validation_flags: [], updated_at: new Date().toISOString() };

      if (existingDraft?.id) {
        await admin.from("intake_item_drafts").update(revDraftPayload).eq("tenant_id", ctx.tenantId).eq("id", existingDraft.id);
      } else {
        await admin.from("intake_item_drafts").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, ...revDraftPayload, created_at: new Date().toISOString() });
      }

      await admin.from("intake_items").update({ status: "persisted", draft_type: "revenue", job_name: resolvedJobName, job_int_id: resolvedJobId, confidence_score: item.confidence_score, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId).eq("id", itemId);

      await admin.from("intake_item_reviews").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, reviewed_by_auth_user_id: ctx.authUserId, action: "confirm", before_payload: beforePayload, after_payload: { transaction_id: revTx.id, amount_cents: amountCents, currency, event_date: eventDate, job_name: resolvedJobName }, created_at: new Date().toISOString() });

      return json(200, { ok: true, intakeItemId: itemId, transactionId: revTx.id, status: "persisted" });
    }

    // ── Lead confirm ─────────────────────────────────────────────────────────
    if (draftType === "lead") {
      const leadCtx = (existingDraft?.raw_model_output as any)?.lead_context || {};
      const contactName = toNullableText(body?.contactName ?? leadCtx?.contact_name) || "Unknown Contact";
      const phone = toNullableText(body?.phone ?? leadCtx?.phone);
      const email = toNullableText(body?.email ?? leadCtx?.email);
      const description = toNullableText(body?.description ?? existingDraft?.description ?? leadCtx?.description);
      const jobName = toNullableText(body?.jobName ?? leadCtx?.job_name) || contactName;

      // Create customer record
      const { data: customer, error: custErr } = await admin
        .from("customers")
        .insert({ tenant_id: ctx.tenantId, name: contactName, phone: phone || null, email: email || null, notes: description || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select("id").single();

      if (custErr || !customer?.id) {
        return json(500, { ok: false, error: custErr?.message || "Failed to create customer record." });
      }

      // Create job in lead stage
      const { data: newJob, error: jobErr } = await admin
        .from("jobs")
        .insert({ job_name: jobName, name: jobName, status: "lead", active: false, owner_id: ctx.ownerId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select("id").single();

      if (jobErr || !newJob?.id) {
        return json(500, { ok: false, error: jobErr?.message || "Failed to create job for lead." });
      }

      // Create job_document in lead stage
      await admin.from("job_documents").insert({ job_id: newJob.id, stage: "lead", lead_notes: description || null, lead_source: "whatsapp", customer_id: customer.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

      const leadDraftPayload = { draft_type: "lead", vendor: contactName, description: description || null, raw_model_output: existingDraft?.raw_model_output || {}, validation_flags: [], updated_at: new Date().toISOString() };
      if (existingDraft?.id) {
        await admin.from("intake_item_drafts").update(leadDraftPayload).eq("tenant_id", ctx.tenantId).eq("id", existingDraft.id);
      } else {
        await admin.from("intake_item_drafts").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, ...leadDraftPayload, created_at: new Date().toISOString() });
      }
      await admin.from("intake_items").update({ status: "persisted", draft_type: "lead", confidence_score: item.confidence_score, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId).eq("id", itemId);
      await admin.from("intake_item_reviews").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, reviewed_by_auth_user_id: ctx.authUserId, action: "confirm", before_payload: beforePayload, after_payload: { job_id: newJob.id, customer_id: customer.id, contact_name: contactName, phone, email }, created_at: new Date().toISOString() });

      return json(200, { ok: true, intakeItemId: itemId, jobId: newJob.id, customerId: customer.id, status: "persisted" });
    }

    // ── Quote confirm ────────────────────────────────────────────────────────
    if (draftType === "quote") {
      const quoteCtx = (existingDraft?.raw_model_output as any)?.quote_context || {};
      const amountCents = toAmountCents(body?.amountCents ?? existingDraft?.amount_cents ?? quoteCtx?.amount_cents);
      const description = toNullableText(body?.description ?? existingDraft?.description ?? quoteCtx?.description);
      const providedJobName = toNullableText(body?.jobName ?? existingDraft?.job_name ?? quoteCtx?.job_name ?? item?.job_name);

      if (!providedJobName) return json(400, { ok: false, error: "A job name is required for a quote." });

      const likeToken = `%${escapeIlike(providedJobName)}%`;
      const { data: jobRows } = await admin.from("jobs").select("id, job_name, name").eq("owner_id", ctx.ownerId).or(`job_name.ilike.${likeToken},name.ilike.${likeToken}`).limit(3);
      let resolvedJobId: number | null = null;
      let resolvedJobName: string | null = null;
      if ((jobRows as any[])?.length > 0) {
        const j = (jobRows as any[])[0];
        resolvedJobId = Number(j.id);
        resolvedJobName = String(j.job_name || j.name || providedJobName);
      } else {
        // Create new job if not found
        const { data: newJob } = await admin.from("jobs").insert({ job_name: providedJobName, name: providedJobName, status: "quote", active: false, owner_id: ctx.ownerId, contract_value_cents: amountCents || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select("id").single();
        if (newJob?.id) { resolvedJobId = Number(newJob.id); resolvedJobName = providedJobName; }
      }

      if (!resolvedJobId) return json(400, { ok: false, error: "Could not resolve or create a job for this quote." });

      // Update job stage to quote and set contract value if provided
      const jobUpdate: Record<string, any> = { status: "quote", updated_at: new Date().toISOString() };
      if (amountCents) jobUpdate.contract_value_cents = amountCents;
      await admin.from("jobs").update(jobUpdate).eq("owner_id", ctx.ownerId).eq("id", resolvedJobId);

      // Upsert job_document at quote stage
      const { data: existingDoc } = await admin.from("job_documents").select("id, stage").eq("job_id", resolvedJobId).maybeSingle();
      if (existingDoc?.id) {
        await admin.from("job_documents").update({ stage: "quote", updated_at: new Date().toISOString() }).eq("id", existingDoc.id);
      } else {
        await admin.from("job_documents").insert({ job_id: resolvedJobId, stage: "quote", lead_notes: description || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }

      const quoteDraftPayload = { draft_type: "quote", amount_cents: amountCents, description: description || null, job_name: resolvedJobName, job_int_id: resolvedJobId, raw_model_output: existingDraft?.raw_model_output || {}, validation_flags: [], updated_at: new Date().toISOString() };
      if (existingDraft?.id) {
        await admin.from("intake_item_drafts").update(quoteDraftPayload).eq("tenant_id", ctx.tenantId).eq("id", existingDraft.id);
      } else {
        await admin.from("intake_item_drafts").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, ...quoteDraftPayload, created_at: new Date().toISOString() });
      }
      await admin.from("intake_items").update({ status: "persisted", draft_type: "quote", job_name: resolvedJobName, job_int_id: resolvedJobId, confidence_score: item.confidence_score, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId).eq("id", itemId);
      await admin.from("intake_item_reviews").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, reviewed_by_auth_user_id: ctx.authUserId, action: "confirm", before_payload: beforePayload, after_payload: { job_id: resolvedJobId, job_name: resolvedJobName, amount_cents: amountCents }, created_at: new Date().toISOString() });

      return json(200, { ok: true, intakeItemId: itemId, jobId: resolvedJobId, jobName: resolvedJobName, status: "persisted" });
    }

    // ── Change order confirm ──────────────────────────────────────────────────
    if (draftType === "change_order") {
      const coCtx = (existingDraft?.raw_model_output as any)?.change_order_context || {};
      const amountCents = toAmountCents(body?.amountCents ?? existingDraft?.amount_cents ?? coCtx?.amount_cents);
      const description = toNullableText(body?.description ?? existingDraft?.description ?? coCtx?.description);
      const providedJobName = toNullableText(body?.jobName ?? existingDraft?.job_name ?? coCtx?.job_name ?? item?.job_name);

      if (!amountCents || amountCents <= 0) return json(400, { ok: false, error: "A valid amount is required." });
      if (!providedJobName) return json(400, { ok: false, error: "A job name is required for a change order." });

      const likeToken = `%${escapeIlike(providedJobName)}%`;
      const { data: jobRows } = await admin.from("jobs").select("id, job_name, name").eq("owner_id", ctx.ownerId).or(`job_name.ilike.${likeToken},name.ilike.${likeToken}`).limit(1);
      const jobRow = (jobRows as any[])?.[0];
      if (!jobRow) return json(400, { ok: false, error: "Job not found. Set the correct job name before confirming." });

      const resolvedJobId = Number(jobRow.id);
      const resolvedJobName = String(jobRow.job_name || jobRow.name || providedJobName);

      // Get next change order number for this job
      const { data: existingCOs } = await admin.from("change_orders").select("number").eq("job_id", resolvedJobId).order("number", { ascending: false }).limit(1);
      const nextNumber = (existingCOs as any[])?.[0]?.number ? Number((existingCOs as any[])[0].number) + 1 : 1;

      const { data: co, error: coErr } = await admin
        .from("change_orders")
        .insert({ job_id: resolvedJobId, tenant_id: ctx.tenantId, number: nextNumber, description: description || "Change order", amount_cents: amountCents, created_at: new Date().toISOString() })
        .select("id").single();

      if (coErr || !co?.id) return json(500, { ok: false, error: coErr?.message || "Failed to create change order." });

      const coDraftPayload = { draft_type: "change_order", amount_cents: amountCents, description: description || null, job_name: resolvedJobName, job_int_id: resolvedJobId, raw_model_output: existingDraft?.raw_model_output || {}, validation_flags: [], updated_at: new Date().toISOString() };
      if (existingDraft?.id) {
        await admin.from("intake_item_drafts").update(coDraftPayload).eq("tenant_id", ctx.tenantId).eq("id", existingDraft.id);
      } else {
        await admin.from("intake_item_drafts").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, ...coDraftPayload, created_at: new Date().toISOString() });
      }
      await admin.from("intake_items").update({ status: "persisted", draft_type: "change_order", job_name: resolvedJobName, job_int_id: resolvedJobId, confidence_score: item.confidence_score, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId).eq("id", itemId);
      await admin.from("intake_item_reviews").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, reviewed_by_auth_user_id: ctx.authUserId, action: "confirm", before_payload: beforePayload, after_payload: { change_order_id: co.id, number: nextNumber, job_id: resolvedJobId, job_name: resolvedJobName, amount_cents: amountCents }, created_at: new Date().toISOString() });

      return json(200, { ok: true, intakeItemId: itemId, changeOrderId: co.id, changeOrderNumber: nextNumber, jobId: resolvedJobId, status: "persisted" });
    }

    // ── Invoice confirm ───────────────────────────────────────────────────────
    if (draftType === "invoice") {
      const invCtx = (existingDraft?.raw_model_output as any)?.invoice_context || {};
      const amountCents = toAmountCents(body?.amountCents ?? existingDraft?.amount_cents ?? invCtx?.amount_cents);
      const description = toNullableText(body?.description ?? existingDraft?.description ?? invCtx?.description);
      const eventDate = toNullableDate(body?.eventDate ?? existingDraft?.event_date) || new Date().toISOString().slice(0, 10);
      const currency = toNullableText(body?.currency ?? existingDraft?.currency) || "USD";
      const providedJobName = toNullableText(body?.jobName ?? existingDraft?.job_name ?? invCtx?.job_name ?? item?.job_name);

      if (!amountCents || amountCents <= 0) return json(400, { ok: false, error: "A valid amount is required." });
      if (!providedJobName) return json(400, { ok: false, error: "A job name is required for an invoice." });

      const likeToken = `%${escapeIlike(providedJobName)}%`;
      const { data: jobRows } = await admin.from("jobs").select("id, job_name, name").eq("owner_id", ctx.ownerId).or(`job_name.ilike.${likeToken},name.ilike.${likeToken}`).limit(1);
      const jobRow = (jobRows as any[])?.[0];
      if (!jobRow) return json(400, { ok: false, error: "Job not found. Set the correct job name before confirming." });

      const resolvedJobId = Number(jobRow.id);
      const resolvedJobName = String(jobRow.job_name || jobRow.name || providedJobName);

      // Record as revenue transaction
      const { data: invTx, error: invErr } = await admin
        .from("transactions")
        .insert({ tenant_id: ctx.tenantId, owner_id: ctx.ownerId, kind: "revenue", amount_cents: amountCents, currency, date: eventDate, description: description || `Invoice — ${resolvedJobName}`, source: "invoice", source_msg_id: item.source_msg_id || item.id, job_name: resolvedJobName, job_id: resolvedJobId, created_at: new Date().toISOString() })
        .select("id").single();

      if (invErr || !invTx?.id) return json(500, { ok: false, error: invErr?.message || "Failed to record invoice." });

      // Update job document stage to invoiced
      const { data: existingDoc } = await admin.from("job_documents").select("id").eq("job_id", resolvedJobId).maybeSingle();
      if (existingDoc?.id) {
        await admin.from("job_documents").update({ stage: "invoiced", updated_at: new Date().toISOString() }).eq("id", existingDoc.id);
      }

      const invDraftPayload = { draft_type: "invoice", amount_cents: amountCents, currency, description: description || null, event_date: eventDate, job_name: resolvedJobName, job_int_id: resolvedJobId, raw_model_output: existingDraft?.raw_model_output || {}, validation_flags: [], updated_at: new Date().toISOString() };
      if (existingDraft?.id) {
        await admin.from("intake_item_drafts").update(invDraftPayload).eq("tenant_id", ctx.tenantId).eq("id", existingDraft.id);
      } else {
        await admin.from("intake_item_drafts").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, ...invDraftPayload, created_at: new Date().toISOString() });
      }
      await admin.from("intake_items").update({ status: "persisted", draft_type: "invoice", job_name: resolvedJobName, job_int_id: resolvedJobId, confidence_score: item.confidence_score, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId).eq("id", itemId);
      await admin.from("intake_item_reviews").insert({ intake_item_id: itemId, tenant_id: ctx.tenantId, owner_id: ctx.ownerId, reviewed_by_auth_user_id: ctx.authUserId, action: "confirm", before_payload: beforePayload, after_payload: { transaction_id: invTx.id, job_id: resolvedJobId, job_name: resolvedJobName, amount_cents: amountCents }, created_at: new Date().toISOString() });

      return json(200, { ok: true, intakeItemId: itemId, transactionId: invTx.id, jobId: resolvedJobId, status: "persisted" });
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
    const payeeName = toNullableText(body?.payeeName ?? existingDraft?.payee_name);

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
      payee_name: payeeName || null,
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
      payee_name: payeeName || null,
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