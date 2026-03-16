import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processExpenseReceipt } from "@/lib/server/documentAiExpense";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type IntakeKind = "receipt_image" | "voice_note" | "pdf_document" | "unknown";
type DraftType = "expense" | "time" | "task" | "revenue" | "unknown";

type CandidateFields = {
  amount_cents: number | null;
  currency: string | null;
  vendor: string | null;
  description: string | null;
  event_date: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  job_name: string | null;
};

type ExtractionResult = {
  text: string;
  source: "ocr_text" | "transcript_text" | "none";
  candidate_fields: CandidateFields;
};

type ValidationResult = {
  confidence_score: number;
  validation_flags: string[];
  required_review: boolean;
};

type PortalContextOk = {
  ok: true;
  admin: any;
  authUserId: string;
  tenantId: string;
  ownerId: string;
  role: string;
};

type PortalContextErr = {
  ok: false;
  error: string;
};

type PortalContext = PortalContextOk | PortalContextErr;

type ProcessResult = {
  processed: boolean;
  status: "pending_review" | "duplicate";
};

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

function adminClient(): any {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function resolveOwnerPlanKey(admin: any, ownerId: string): Promise<string> {
  const owner = String(ownerId || "").trim();
  if (!owner) return "free";

  try {
    const { data } = await admin
      .from("users")
      .select("plan_key, subscription_tier, stripe_subscription_id, current_period_end, trial_end, sub_status")
      .eq("user_id", owner)
      .limit(1)
      .maybeSingle();

    const row = data || null;
    const planKey = String(row?.plan_key || "").toLowerCase().trim();
    const tier = String(row?.subscription_tier || "").toLowerCase().trim();
    const subId = String(row?.stripe_subscription_id || "").trim();
    const status = String(row?.sub_status || "").toLowerCase().trim();

    const now = Date.now();
    const trialEnd = row?.trial_end ? new Date(row.trial_end).getTime() : 0;
    const periodEnd = row?.current_period_end ? new Date(row.current_period_end).getTime() : 0;

    const onTrial = !!trialEnd && trialEnd > now;
    const inPeriod = !!periodEnd && periodEnd > now;

    if (
      onTrial ||
      inPeriod ||
      (!!subId && status !== "canceled" && status !== "cancelled") ||
      ["starter", "pro", "beta", "paid"].includes(planKey) ||
      ["starter", "pro"].includes(tier)
    ) {
      return ["pro"].includes(planKey) || ["pro"].includes(tier) ? "pro" : "starter";
    }

    return "free";
  } catch {
    return "free";
  }
}

async function getPortalContext(req: Request): Promise<PortalContext> {
  const token = bearerFromReq(req);
  if (!token) return { ok: false, error: "Missing bearer token." };

  const admin = adminClient();
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user?.id) return { ok: false, error: "Invalid session." };

  const authUserId = String(authData.user.id);

  const { data: pu, error: puErr } = await admin
    .from("chiefos_portal_users")
    .select("tenant_id, role, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (puErr) return { ok: false, error: puErr.message || "Failed to resolve membership." };
  if (!pu?.tenant_id) return { ok: false, error: "Missing tenant context." };

  const { data: tenant, error: tErr } = await admin
    .from("chiefos_tenants")
    .select("id, owner_id")
    .eq("id", pu.tenant_id)
    .single();

  if (tErr || !tenant?.owner_id) {
    return { ok: false, error: tErr?.message || "Missing owner context." };
  }

  return {
    ok: true,
    admin,
    authUserId,
    tenantId: String(pu.tenant_id),
    ownerId: String(tenant.owner_id),
    role: String(pu.role || ""),
  };
}

function draftFromMime(mime: string | null, filename: string | null): { draftType: DraftType; kind: IntakeKind } {
  const m = String(mime || "").toLowerCase();
  const f = String(filename || "").toLowerCase();

  if (m.startsWith("image/")) return { draftType: "expense", kind: "receipt_image" };
  if (m.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(f)) {
    return { draftType: "unknown", kind: "voice_note" };
  }
  if (m === "application/pdf" || f.endsWith(".pdf")) return { draftType: "expense", kind: "pdf_document" };
  return { draftType: "unknown", kind: "unknown" };
}

function normalizeWhitespace(input: string | null | undefined) {
  return String(input || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMoneyToCents(raw: string): number | null {
  const cleaned = String(raw || "").replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;

  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    normalized = normalized.replace(/,/g, "");
  } else if (commaCount > 0 && dotCount === 0) {
    const lastComma = normalized.lastIndexOf(",");
    if (normalized.length - lastComma <= 3) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;

  return Math.round(n * 100);
}

function detectCurrency(text: string): string | null {
  const t = text.toUpperCase();
  if (/\bCAD\b|C\$/.test(t)) return "CAD";
  if (/\bUSD\b|\$/.test(t)) return "USD";
  if (/\bEUR\b|€/.test(t)) return "EUR";
  if (/\bGBP\b|£/.test(t)) return "GBP";
  return null;
}

function parseDateCandidate(text: string): string | null {
  const patterns = [
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,]+(\d{1,2})[\s,]+(\d{2,4})\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;

    try {
      if (re === patterns[0]) {
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }

      if (re === patterns[1]) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        const c = Number(m[3]);
        const year = c < 100 ? 2000 + c : c;
        if (year >= 2000 && a >= 1 && a <= 12 && b >= 1 && b <= 31) {
          return `${year.toString().padStart(4, "0")}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
        }
      }

      if (re === patterns[2]) {
        const monthNames: Record<string, number> = {
          jan: 1,
          feb: 2,
          mar: 3,
          apr: 4,
          may: 5,
          jun: 6,
          jul: 7,
          aug: 8,
          sep: 9,
          sept: 9,
          oct: 10,
          nov: 11,
          dec: 12,
        };
        const month = monthNames[String(m[1]).toLowerCase()] || 0;
        const day = Number(m[2]);
        const yearRaw = Number(m[3]);
        const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
        if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    } catch {
      // safe-fail
    }
  }

  return null;
}

function pickVendorFromLines(text: string): string | null {
  const blocked = [
    "receipt",
    "invoice",
    "total",
    "subtotal",
    "tax",
    "hst",
    "gst",
    "pst",
    "visa",
    "mastercard",
    "debit",
    "change",
    "cash",
    "thank you",
    "approved",
    "transaction",
    "auth",
    "date",
    "time",
  ];

  const lines = normalizeWhitespace(text)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    const lc = line.toLowerCase();
    if (lc.length < 2) continue;
    if (/\d{2,}/.test(lc) && lc.length < 8) continue;
    if (blocked.some((b) => lc.includes(b))) continue;
    if (/^[^a-zA-Z]*$/.test(line)) continue;
    return line.slice(0, 80);
  }

  return null;
}

function findAmountCandidates(text: string): Array<{ label: string; cents: number }> {
  const out: Array<{ label: string; cents: number }> = [];
  const normalized = normalizeWhitespace(text);
  const lines = normalized.split("\n");

  const amountRegex = /(?:^|[^\d])((?:\$|CAD|USD|EUR|GBP|C\$)?\s*-?\d[\d,]*[.,]\d{2})(?:[^\d]|$)/gi;

  for (const line of lines) {
    const lc = line.toLowerCase();
    let match: RegExpExecArray | null;

    while ((match = amountRegex.exec(line))) {
      const cents = parseMoneyToCents(match[1]);
      if (cents == null) continue;

      let label = "amount";
      if (lc.includes("total")) label = "total";
      else if (lc.includes("subtotal")) label = "subtotal";
      else if (lc.includes("tax") || lc.includes("hst") || lc.includes("gst") || lc.includes("pst")) label = "tax";

      out.push({ label, cents });
    }
  }

  return out;
}

function buildDescription(kind: IntakeKind, vendor: string | null, text: string): string | null {
  if (vendor) {
    if (kind === "receipt_image" || kind === "pdf_document") return `Expense from ${vendor}`;
    if (kind === "voice_note") return `Voice note draft${vendor ? ` mentioning ${vendor}` : ""}`;
  }

  const firstMeaningful = normalizeWhitespace(text)
    .split("\n")
    .map((s) => s.trim())
    .find((line) => line.length >= 6);

  return firstMeaningful ? firstMeaningful.slice(0, 120) : null;
}

function extractCandidateFields(kind: IntakeKind, text: string, existingJobName: string | null): ExtractionResult {
  const normalized = normalizeWhitespace(text);
  const amounts = findAmountCandidates(normalized);

  const subtotal = amounts.find((x) => x.label === "subtotal")?.cents ?? null;
  const tax = amounts.find((x) => x.label === "tax")?.cents ?? null;
  const total = amounts.find((x) => x.label === "total")?.cents ?? null;

  let amount_cents: number | null = total;
  if (amount_cents == null && amounts.length > 0) {
    amount_cents = [...amounts].sort((a, b) => b.cents - a.cents)[0]?.cents ?? null;
  }

  const vendor = pickVendorFromLines(normalized);
  const event_date = parseDateCandidate(normalized);
  const currency = detectCurrency(normalized);
  const description = buildDescription(kind, vendor, normalized);

  const source: "ocr_text" | "transcript_text" | "none" =
    kind === "voice_note" ? (normalized ? "transcript_text" : "none") : normalized ? "ocr_text" : "none";

  return {
    text: normalized,
    source,
    candidate_fields: {
      amount_cents,
      currency,
      vendor,
      description,
      event_date,
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      job_name: existingJobName ? String(existingJobName) : null,
    },
  };
}

function validateExtraction(kind: IntakeKind, extraction: ExtractionResult, itemJobName: string | null): ValidationResult {
  const flags: string[] = [];
  const f = extraction.candidate_fields;
  const text = extraction.text;

  if (kind === "unknown") flags.push("unsupported_file_type");

  if (kind === "receipt_image" && !text) flags.push("ocr_pending");
  if (kind === "pdf_document" && !text) flags.push("pdf_text_empty");
  if (kind === "voice_note" && !text) flags.push("voice_transcript_low_confidence");

  if (f.amount_cents == null) flags.push("missing_amount");
  if (!f.vendor) flags.push("missing_vendor");
  if (!f.event_date) flags.push("missing_date");
  if (!itemJobName && !f.job_name) flags.push("job_unresolved");

  const amountCandidates = findAmountCandidates(text);
  const totalCount = amountCandidates.filter((x) => x.label === "total").length;
  if (totalCount > 1) flags.push("multiple_totals_detected");

  if (
    f.subtotal_cents != null &&
    f.tax_cents != null &&
    f.total_cents != null &&
    f.subtotal_cents + f.tax_cents !== f.total_cents
  ) {
    flags.push("subtotal_tax_total_mismatch");
  }

  let confidence = 0.92;

  if (!text) confidence -= 0.35;
  if (f.amount_cents == null) confidence -= 0.28;
  if (!f.vendor) confidence -= 0.16;
  if (!f.event_date) confidence -= 0.12;
  if (!itemJobName && !f.job_name) confidence -= 0.08;
  if (flags.includes("multiple_totals_detected")) confidence -= 0.12;
  if (flags.includes("subtotal_tax_total_mismatch")) confidence -= 0.12;
  if (flags.includes("unsupported_file_type")) confidence -= 0.22;

  if (kind === "voice_note" && !text) confidence -= 0.1;
  if (kind === "pdf_document" && !text) confidence -= 0.1;

  confidence = Math.max(0.05, Math.min(0.99, Number(confidence.toFixed(2))));

  if (f.amount_cents == null) flags.push("low_confidence_amount");
  if (!f.vendor) flags.push("low_confidence_vendor");

  return {
    confidence_score: confidence,
    validation_flags: Array.from(new Set(flags)),
    required_review: true,
  };
}

function enrichDraft(kind: IntakeKind, extraction: ExtractionResult, validation: ValidationResult, filename: string | null) {
  const f = extraction.candidate_fields;
  const review_summary =
    validation.validation_flags.length === 0
      ? "Draft looks structurally clean, but still requires owner confirmation."
      : `Draft requires review: ${validation.validation_flags.join(", ")}.`;

  const suggested_job_terms =
    f.job_name && f.job_name.trim()
      ? [f.job_name.trim()]
      : filename
      ? String(filename)
          .replace(/\.[a-z0-9]+$/i, "")
          .split(/[_\-\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 4)
          .slice(0, 4)
      : [];

  return {
    review_summary,
    suggested_job_terms,
    explain_amount_source:
      f.total_cents != null
        ? "Amount came from a detected total line."
        : f.amount_cents != null
        ? "Amount came from the strongest detected money value."
        : "No reliable amount was detected.",
    explain_vendor_source: f.vendor
      ? "Vendor came from the strongest early evidence line."
      : "Vendor could not be confidently inferred.",
    kind,
  };
}

async function downloadStorageBytes(admin: any, bucket: string, path: string) {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || "Failed to download intake evidence.");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const parts: string[] = [];

  const tjMatches = raw.match(/\((?:\\.|[^\\()])*\)\s*Tj/g) || [];
  for (const match of tjMatches) {
    const textMatch = match.match(/\(((?:\\.|[^\\()])*)\)\s*Tj/);
    if (textMatch?.[1]) {
      parts.push(textMatch[1]);
    }
  }

  const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = tjArrayRegex.exec(raw))) {
    const block = blockMatch[1] || "";
    const parenMatches = block.match(/\((?:\\.|[^\\()])*\)/g) || [];
    for (const p of parenMatches) {
      parts.push(p.slice(1, -1));
    }
  }

  const cleaned = parts
    .join("\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");

  return normalizeWhitespace(cleaned);
}

async function hydrateEvidenceText(
  admin: any,
  item: any,
  inferred: { kind: IntakeKind },
  ownerId: string
) {
  const existingOcr = normalizeWhitespace(item?.ocr_text);
  const existingTranscript = normalizeWhitespace(item?.transcript_text);

  if (inferred.kind === "voice_note") {
    return {
      bestText: existingTranscript,
      ocr_text: item?.ocr_text || null,
      transcript_text: existingTranscript || null,
      hydratedFromStorage: false,
      hydrationNote: existingTranscript ? "Used existing transcript_text." : "No transcript available yet.",
      documentAiFields: null,
    };
  }

  if (inferred.kind === "receipt_image") {
    if (existingOcr) {
      return {
        bestText: existingOcr,
        ocr_text: existingOcr || null,
        transcript_text: item?.transcript_text || null,
        hydratedFromStorage: false,
        hydrationNote: "Used existing ocr_text.",
        documentAiFields: null,
      };
    }

    try {
      const bytes = await downloadStorageBytes(
        admin,
        String(item?.storage_bucket || ""),
        String(item?.storage_path || "")
      );

      const out = await processExpenseReceipt({
        projectId: mustEnv("GOOGLE_DOCUMENT_AI_PROJECT_ID"),
        processorId: mustEnv("GOOGLE_DOCUMENT_AI_RECEIPT_PROCESSOR_ID"),
        location: process.env.GOOGLE_DOCUMENT_AI_LOCATION || "us",
        bytes,
        mimeType: item?.mime_type || "image/jpeg",
      });

      const text = normalizeWhitespace(out?.text || "");
      const fields = out?.fields || null;

      console.info("[INTAKE_RECEIPT_OCR_OK]", {
        itemId: String(item?.id || ""),
        hasText: Boolean(text),
        textLen: String(text || "").length,
        fields,
      });

      return {
        bestText: text,
        ocr_text: text || null,
        transcript_text: item?.transcript_text || null,
        hydratedFromStorage: Boolean(text),
        hydrationNote: text
          ? "Hydrated OCR text from receipt image using Document AI."
          : "Receipt image OCR ran, but no reliable text was extracted.",
        documentAiFields: fields,
      };
    } catch (e: any) {
      console.error("[INTAKE_RECEIPT_OCR_FAIL]", {
        itemId: String(item?.id || ""),
        bucket: String(item?.storage_bucket || ""),
        path: String(item?.storage_path || ""),
        ownerId: String(ownerId || ""),
        message: e?.message || "Receipt image OCR failed.",
      });

      return {
        bestText: "",
        ocr_text: item?.ocr_text || null,
        transcript_text: item?.transcript_text || null,
        hydratedFromStorage: false,
        hydrationNote: e?.message || "Receipt image OCR failed.",
        documentAiFields: null,
      };
    }
  }

  if (inferred.kind === "pdf_document") {
    if (existingOcr) {
      return {
        bestText: existingOcr,
        ocr_text: existingOcr || null,
        transcript_text: item?.transcript_text || null,
        hydratedFromStorage: false,
        hydrationNote: "Used existing PDF text already stored on item.",
        documentAiFields: null,
      };
    }

    try {
      const bytes = await downloadStorageBytes(
        admin,
        String(item?.storage_bucket || ""),
        String(item?.storage_path || "")
      );

      const pdfText = extractTextFromPdfBuffer(bytes);

      return {
        bestText: pdfText,
        ocr_text: pdfText || null,
        transcript_text: item?.transcript_text || null,
        hydratedFromStorage: Boolean(pdfText),
        hydrationNote: pdfText
          ? "Hydrated text from digital PDF content."
          : "PDF downloaded, but no reliable text could be extracted.",
        documentAiFields: null,
      };
    } catch (e: any) {
      return {
        bestText: "",
        ocr_text: item?.ocr_text || null,
        transcript_text: item?.transcript_text || null,
        hydratedFromStorage: false,
        hydrationNote: e?.message || "Failed PDF hydration.",
        documentAiFields: null,
      };
    }
  }

  return {
    bestText: existingOcr || existingTranscript || "",
    ocr_text: existingOcr || null,
    transcript_text: existingTranscript || null,
    hydratedFromStorage: false,
    hydrationNote: "Unsupported file type.",
    documentAiFields: null,
  };
}
export async function POST(req: Request) {
  try {
    const ctx = await getPortalContext(req);
    if (!ctx.ok) return json(401, { ok: false, error: ctx.error });

    const admin = ctx.admin;
    const tenantId = ctx.tenantId;
    const ownerId = ctx.ownerId;
    const role = ctx.role;

    if (!(role === "owner" || role === "admin" || role === "board")) {
      return json(403, { ok: false, error: "Owner-only or approver-only action." });
    }

    const body = await req.json().catch(() => ({}));
    const batchId = String(body?.batchId || "").trim();
    if (!batchId) return json(400, { ok: false, error: "Missing batchId." });

    const { data: items, error: itemsErr } = await admin
      .from("intake_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      return json(500, { ok: false, error: itemsErr.message || "Failed to load batch items." });
    }

    const rows = (items || []).filter((item: any) =>
      ["uploaded", "normalized", "extracted"].includes(String(item?.status || ""))
    );

    const CONCURRENCY = 5;

    async function processOneItem(item: any): Promise<ProcessResult> {
      if (item?.source_hash) {
        const { data: dup, error: dupErr } = await admin
          .from("intake_items")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("source_hash", item.source_hash)
          .neq("id", item.id)
          .limit(1)
          .maybeSingle();

        if (dupErr) {
          throw new Error(dupErr.message || "Failed duplicate detection.");
        }

        if (dup?.id) {
          const { error: markDupErr } = await admin
            .from("intake_items")
            .update({
              status: "duplicate",
              duplicate_of_item_id: dup.id,
              updated_at: new Date().toISOString(),
            } as any)
            .eq("tenant_id", tenantId)
            .eq("id", item.id);

          if (markDupErr) {
            throw new Error(markDupErr.message || "Failed to mark duplicate item.");
          }

          return { processed: true, status: "duplicate" };
        }
      }

      const inferred = draftFromMime(item?.mime_type, item?.source_filename);
      const hydrated = await hydrateEvidenceText(admin, item, inferred, ownerId);
const normalizedEvidenceText = normalizeWhitespace(hydrated.bestText);

const extraction = extractCandidateFields(
  inferred.kind,
  normalizedEvidenceText,
  item?.job_name || null
);

// Merge stronger structured OCR fields when available
const docFields = hydrated.documentAiFields || null;
if (docFields) {
  const supplier = String(docFields.supplier || "").trim() || null;
  const receiptDateRaw = String(docFields.receiptDate || "").trim() || null;
  const totalRaw = String(docFields.total || "").trim() || null;
  const currencyRaw = String(docFields.currency || "").trim().toUpperCase() || null;

  const receiptDate = receiptDateRaw ? parseDateCandidate(receiptDateRaw) || receiptDateRaw : null;
  const totalCents = totalRaw ? parseMoneyToCents(totalRaw) : null;

  if (!extraction.candidate_fields.vendor && supplier) {
    extraction.candidate_fields.vendor = supplier;
  }

  if (!extraction.candidate_fields.event_date && receiptDate) {
    extraction.candidate_fields.event_date = receiptDate;
  }

  if (totalCents != null) {
    extraction.candidate_fields.total_cents = totalCents;
    extraction.candidate_fields.amount_cents = totalCents;
  }

  if (!extraction.candidate_fields.currency && currencyRaw) {
    extraction.candidate_fields.currency = currencyRaw;
  }

  if (!extraction.candidate_fields.description && supplier) {
    extraction.candidate_fields.description = `Expense from ${supplier}`;
  }
}

      const validation = validateExtraction(
        inferred.kind,
        extraction,
        item?.job_name || null
      );

      const enrichment = enrichDraft(
        inferred.kind,
        extraction,
        validation,
        item?.source_filename || null
      );

      const rawModelOutput = {
        pipeline_version: "phase1-layered-parsing-v2",
        normalize: {
          kind: inferred.kind,
          draft_type: inferred.draftType,
          mime_type: item?.mime_type || null,
          source_filename: item?.source_filename || null,
          storage_bucket: item?.storage_bucket || null,
          storage_path: item?.storage_path || null,
        },
        hydrate: {
          hydrated_from_storage: hydrated.hydratedFromStorage,
          hydration_note: hydrated.hydrationNote,
        },
        extract: {
          source: extraction.source,
          text_present: Boolean(extraction.text),
          text_preview: extraction.text ? extraction.text.slice(0, 1200) : "",
          candidate_fields: extraction.candidate_fields,
        },
        validate: validation,
        enrich: enrichment,
      };

      const draftPayload = {
        intake_item_id: item.id,
        tenant_id: tenantId,
        owner_id: ownerId,
        draft_type: inferred.draftType,
        amount_cents: extraction.candidate_fields.amount_cents,
        currency: extraction.candidate_fields.currency,
        vendor: extraction.candidate_fields.vendor,
        description: extraction.candidate_fields.description,
        event_date: extraction.candidate_fields.event_date,
        job_int_id: item?.job_int_id ?? null,
        job_name: extraction.candidate_fields.job_name || item?.job_name || null,
        raw_model_output: rawModelOutput,
        validation_flags: validation.validation_flags,
        updated_at: new Date().toISOString(),
      };

      const { data: existingDraft, error: existingDraftErr } = await admin
        .from("intake_item_drafts")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("intake_item_id", item.id)
        .limit(1)
        .maybeSingle();

      if (existingDraftErr) {
        throw new Error(existingDraftErr.message || "Failed to inspect existing draft.");
      }

      if (existingDraft?.id) {
        const { error: updateDraftErr } = await admin
          .from("intake_item_drafts")
          .update(draftPayload as any)
          .eq("tenant_id", tenantId)
          .eq("id", existingDraft.id);

        if (updateDraftErr) {
          throw new Error(updateDraftErr.message || "Failed to update intake draft.");
        }
      } else {
        const { error: insertDraftErr } = await admin
          .from("intake_item_drafts")
          .insert({
            ...draftPayload,
            created_at: new Date().toISOString(),
          } as any);

        if (insertDraftErr) {
          throw new Error(insertDraftErr.message || "Failed to create intake draft.");
        }
      }

      const nextItemUpdate: Record<string, any> = {
        draft_type: inferred.draftType,
        kind: inferred.kind,
        status: "pending_review",
        confidence_score: validation.confidence_score,
        updated_at: new Date().toISOString(),
      };

      if (typeof hydrated.ocr_text === "string" || hydrated.ocr_text === null) {
        nextItemUpdate.ocr_text = hydrated.ocr_text;
      }

      if (typeof hydrated.transcript_text === "string" || hydrated.transcript_text === null) {
        nextItemUpdate.transcript_text = hydrated.transcript_text;
      }

      const { error: updateItemErr } = await admin
        .from("intake_items")
        .update(nextItemUpdate as any)
        .eq("tenant_id", tenantId)
        .eq("id", item.id);

      if (updateItemErr) {
        throw new Error(updateItemErr.message || "Failed to update intake item status.");
      }

      return { processed: true, status: "pending_review" };
    }

    const results: ProcessResult[] = [];

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);
      const chunkResults: ProcessResult[] = await Promise.all(
        chunk.map((item: any) => processOneItem(item))
      );
      results.push(...chunkResults);
    }

    const processedCount = results.filter((r) => r.processed).length;

    const { count: pendingCount, error: pendingCountErr } = await admin
      .from("intake_items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("batch_id", batchId)
      .eq("status", "pending_review");

    if (pendingCountErr) {
      return json(500, {
        ok: false,
        error: pendingCountErr.message || "Failed to count pending review items.",
      });
    }

    const { count: duplicateCount, error: duplicateCountErr } = await admin
      .from("intake_items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("batch_id", batchId)
      .eq("status", "duplicate");

    if (duplicateCountErr) {
      return json(500, {
        ok: false,
        error: duplicateCountErr.message || "Failed to count duplicate items.",
      });
    }

    const { count: skippedCount, error: skippedCountErr } = await admin
      .from("intake_items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("batch_id", batchId)
      .eq("status", "skipped");

    if (skippedCountErr) {
      return json(500, {
        ok: false,
        error: skippedCountErr.message || "Failed to count skipped items.",
      });
    }

    const { count: confirmedCount, error: confirmedCountErr } = await admin
      .from("intake_items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("batch_id", batchId)
      .in("status", ["confirmed", "persisted"]);

    if (confirmedCountErr) {
      return json(500, {
        ok: false,
        error: confirmedCountErr.message || "Failed to count confirmed items.",
      });
    }

    const batchStatus =
      (pendingCount || 0) > 0
        ? "pending_review"
        : ((confirmedCount || 0) + (duplicateCount || 0) + (skippedCount || 0)) > 0
        ? "completed"
        : "uploaded";

    const { error: batchErr } = await admin
      .from("intake_batches")
      .update({
        status: batchStatus,
        confirmed_items: confirmedCount || 0,
        duplicate_items: duplicateCount || 0,
        skipped_items: skippedCount || 0,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("tenant_id", tenantId)
      .eq("id", batchId);

    if (batchErr) {
      return json(500, {
        ok: false,
        error: batchErr.message || "Failed to update intake batch.",
      });
    }

    return json(200, {
      ok: true,
      batchId,
      processedCount,
      pendingCount: pendingCount || 0,
      duplicateCount: duplicateCount || 0,
      skippedCount: skippedCount || 0,
      confirmedCount: confirmedCount || 0,
      message: "Batch processed into layered parsing drafts and moved into pending review.",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Processing failed." });
  }
}