"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import ReviewConveyor from "@/app/app/components/intake/ReviewConveyor";
import ExplainExpensePanel from "@/app/app/components/intake/ExplainExpensePanel";
import BatchProgressBar from "@/app/app/components/intake/BatchProgressBar";
import JobSuggestionPicker from "@/app/app/components/intake/JobSuggestionPicker";
import { classifyExpense } from "@/lib/expense/classify";

type IntakeItem = {
  id: string;
  batch_id: string;
  kind: string;
  status: string;
  storage_bucket: string;
  storage_path: string;
  source_filename: string | null;
  mime_type: string | null;
  draft_type: string | null;
  confidence_score: number | null;
  job_name: string | null;
  ocr_text: string | null;
  transcript_text: string | null;
  created_at: string;
};

type IntakeDraft = {
  id: string;
  intake_item_id: string;
  draft_type: string;
  amount_cents: number | null;
  currency: string | null;
  vendor: string | null;
  description: string | null;
  event_date: string | null;
  job_name: string | null;
  expense_category: string | null;
  is_personal: boolean | null;
  validation_flags: string[];
  raw_model_output?: Record<string, any>;
};

type IntakeReview = {
  id: string;
  action: string;
  after_payload?: Record<string, any>;
  comment?: string | null;
  created_at: string;
};

type ItemDetailResponse = {
  ok: true;
  item: IntakeItem;
  draft: IntakeDraft | null;
  reviews: IntakeReview[];
  batchProgress: {
    total: number;
    pending: number;
    persisted: number;
    skipped: number;
    duplicate: number;
    failed: number;
    currentIndex: number;
  };
  nav: {
    prevItemId: string | null;
    nextItemId: string | null;
    nextPendingItemId: string | null;
  };
  jobSuggestions: Array<{ id: number; job_name: string; status?: string | null }>;
  evidence?: {
    storage_bucket: string;
    storage_path: string;
    source_filename: string | null;
    mime_type: string | null;
    kind: string;
  };
  extractedText?: {
    ocr_text: string | null;
    transcript_text: string | null;
    best_text: string | null;
  };
  parse?: Record<string, any> | null;
  reviewState?: {
    validationFlags: string[];
    fastConfirmReady: boolean;
    hasBlockingFlags: boolean;
    readyReason: string;
  };
};

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return "—";
  const code = String(currency || "USD").toUpperCase();
  try {
    return (Number(cents) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: code,
    });
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${code}`;
  }
}

function flagLabel(flag: string) {
  return String(flag || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function flagReason(flag: string) {
  const map: Record<string, string> = {
    missing_amount: "No reliable total was detected from the extracted evidence.",
    missing_vendor: "The system could not confidently identify the vendor or source.",
    missing_date: "A reliable transaction date was not found in the extracted evidence.",
    multiple_totals_detected: "More than one possible total was found, so the amount needs owner review.",
    subtotal_tax_total_mismatch: "Subtotal, tax, and total did not reconcile cleanly.",
    unsupported_currency: "The detected currency did not look safe for automatic interpretation.",
    low_confidence_amount: "The amount signal is weak and should be reviewed before confirming.",
    low_confidence_vendor: "The vendor signal is weak and should be reviewed before confirming.",
    possible_duplicate_attachment: "This file may match a previously uploaded attachment.",
    possible_duplicate_content: "The extracted content appears similar to another item.",
    job_unresolved: "A job could not be safely attached yet.",
    job_ambiguous: "More than one job may match this item.",
    receipt_image_blurry: "The receipt image appears hard to read, which lowers extraction confidence.",
    pdf_text_empty: "No reliable text was extracted from the PDF yet.",
    voice_transcript_low_confidence: "The voice transcript is weak or incomplete.",
    unsupported_file_type: "This file type is not yet fully supported for structured parsing.",
    ocr_pending: "OCR text is not available yet, so this item is being held for review.",
  };

  return map[flag] || "This item needs owner review before it can become truth.";
}

function confidenceTone(score?: number | null) {
  const n = Number(score ?? 0);
  if (n >= 0.85) return "text-emerald-300 border-emerald-500/20 bg-emerald-500/10";
  if (n >= 0.6) return "text-amber-200 border-amber-500/20 bg-amber-500/10";
  return "text-red-200 border-red-500/20 bg-red-500/10";
}

export default function PendingReviewItemPage() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const params = useParams<{ itemId: string }>();
  const router = useRouter();
  const itemId = String(params?.itemId || "");

  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [item, setItem] = useState<IntakeItem | null>(null);
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [reviews, setReviews] = useState<IntakeReview[]>([]);
  const [batchProgress, setBatchProgress] = useState<ItemDetailResponse["batchProgress"] | null>(null);
  const [nav, setNav] = useState<ItemDetailResponse["nav"] | null>(null);
  const [jobSuggestions, setJobSuggestions] = useState<ItemDetailResponse["jobSuggestions"]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<ItemDetailResponse["extractedText"] | null>(null);
  const [parse, setParse] = useState<Record<string, any> | null>(null);
  const [reviewState, setReviewState] = useState<ItemDetailResponse["reviewState"] | null>(null);

  const [jobNameOverride, setJobNameOverride] = useState("");

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const token = await authToken();
      if (!token) throw new Error("Missing session.");

      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const j = (await r.json().catch(() => ({}))) as Partial<ItemDetailResponse> & {
        ok?: boolean;
        error?: string;
      };

      if (!r.ok || !j?.ok || !j.item) {
        throw new Error(j?.error || "Failed to load item.");
      }

      setItem(j.item);
      setDraft(j.draft || null);
      setReviews(Array.isArray(j.reviews) ? j.reviews : []);
      setBatchProgress(j.batchProgress || null);
      setNav(j.nav || null);
      setJobSuggestions(Array.isArray(j.jobSuggestions) ? j.jobSuggestions : []);
      setExtractedText(j.extractedText || null);
      setParse((j.parse as Record<string, any>) || null);
      setReviewState(j.reviewState || null);
      setJobNameOverride(String(j.draft?.job_name || j.item.job_name || ""));

      // Pre-fill overhead form if this is an overhead item
      if (j.draft?.draft_type === "overhead" || j.item.draft_type === "overhead") {
        const ohCtx = (j.draft?.raw_model_output as any)?.overhead_context || {};
        setOhName(String(ohCtx?.name || j.draft?.vendor || ""));
        setOhCategory(String(ohCtx?.category || "other"));
        setOhFrequency(String(ohCtx?.frequency || "monthly"));
        setOhAmount(j.draft?.amount_cents != null ? String(j.draft.amount_cents / 100) : "");
        setOhDueDay(ohCtx?.due_day != null ? String(ohCtx.due_day) : "");
        setOhNotes(String(j.draft?.description || ""));
      }

      const signed = await supabase.storage
        .from(j.item.storage_bucket)
        .createSignedUrl(j.item.storage_path, 60 * 15);

      if (!signed.error) setSignedUrl(signed.data?.signedUrl || null);
      else setSignedUrl(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load pending review item.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!gate.loading && itemId) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.loading, itemId]);

  async function goNextOrQueue() {
    if (nav?.nextPendingItemId) {
      router.replace(`/app/pending-review/${nav.nextPendingItemId}`);
      return;
    }
    router.replace("/app/pending-review");
  }

  // Overhead-specific confirm state
  const [ohName, setOhName] = useState("");
  const [ohCategory, setOhCategory] = useState("other");
  const [ohFrequency, setOhFrequency] = useState("monthly");
  const [ohAmount, setOhAmount] = useState("");
  const [ohDueDay, setOhDueDay] = useState("");
  const [ohNotes, setOhNotes] = useState("");

  async function doConfirm(payload: {
    amountCents: number;
    vendor: string | null;
    description: string | null;
    eventDate: string | null;
    jobName: string | null;
    currency: string;
    expenseCategory: string | null;
    isPersonal: boolean;
    payeeName: string | null;
    edited: boolean;
  }) {
    try {
      setMutating(true);
      setErr(null);

      const token = await authToken();
      if (!token) throw new Error("Missing session.");

      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          jobName: jobNameOverride.trim() || payload.jobName,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Confirm failed.");

      await goNextOrQueue();
    } catch (e: any) {
      setErr(e?.message || "Confirm failed.");
    } finally {
      setMutating(false);
    }
  }

  async function doConfirmOverhead() {
    const amountCents = Math.round(parseFloat(ohAmount) * 100);
    if (!ohName.trim()) { setErr("Name is required."); return; }
    if (!amountCents || amountCents <= 0) { setErr("A valid amount is required."); return; }
    try {
      setMutating(true);
      setErr(null);
      const token = await authToken();
      if (!token) throw new Error("Missing session.");
      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          draftType: "overhead",
          name: ohName.trim(),
          category: ohCategory,
          frequency: ohFrequency,
          amountCents,
          dueDay: ohDueDay ? parseInt(ohDueDay, 10) : null,
          notes: ohNotes.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Confirm failed.");
      await goNextOrQueue();
    } catch (e: any) {
      setErr(e?.message || "Confirm failed.");
    } finally {
      setMutating(false);
    }
  }

  async function doSkip(payload?: { comment?: string }) {
    try {
      setMutating(true);
      setErr(null);

      const token = await authToken();
      if (!token) throw new Error("Missing session.");

      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/skip`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload || {}),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Skip failed.");

      await goNextOrQueue();
    } catch (e: any) {
      setErr(e?.message || "Skip failed.");
    } finally {
      setMutating(false);
    }
  }

  async function doDelete(payload?: { comment?: string }) {
  try {
    setMutating(true);
    setErr(null);

    const token = await authToken();
    if (!token) throw new Error("Missing session.");

    const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error || "Delete failed.");

    router.replace("/app/pending-review");
  } catch (e: any) {
    setErr(e?.message || "Delete failed.");
  } finally {
    setMutating(false);
  }
}

  async function doDuplicate(payload?: { duplicateOfItemId?: string; comment?: string }) {
    try {
      setMutating(true);
      setErr(null);

      const token = await authToken();
      if (!token) throw new Error("Missing session.");

      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/duplicate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload || {}),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Duplicate action failed.");

      await goNextOrQueue();
    } catch (e: any) {
      setErr(e?.message || "Duplicate action failed.");
    } finally {
      setMutating(false);
    }
  }

  const latestConfirmReview = useMemo(() => {
    return reviews.find((r) => r.action === "confirm" || r.action === "edit_confirm") || null;
  }, [reviews]);

  const validationFlags = reviewState?.validationFlags || draft?.validation_flags || [];
  const fastConfirmReady = Boolean(reviewState?.fastConfirmReady);
  const hasBlockingFlags = Boolean(reviewState?.hasBlockingFlags);
  const readyReason =
    String(reviewState?.readyReason || "").trim() ||
    (fastConfirmReady
      ? "This draft is ready for one-tap confirm."
      : "This draft still needs owner review before confirm.");

  const parseSummary = parse?.enrich?.review_summary
    ? String(parse.enrich.review_summary)
    : readyReason;

  const preview = useMemo(() => {
    if (!item || !signedUrl) return null;

    if (item.kind === "receipt_image") {
      return (
        <img
          src={signedUrl}
          alt={item.source_filename || "Receipt"}
          className="max-h-[72vh] w-full rounded-2xl border border-white/10 object-contain bg-black"
        />
      );
    }

    if (item.kind === "pdf_document") {
      return (
        <iframe
          src={signedUrl}
          title={item.source_filename || "PDF"}
          className="h-[72vh] w-full rounded-2xl border border-white/10 bg-white"
        />
      );
    }

    if (item.kind === "voice_note") {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <audio controls className="w-full">
            <source src={signedUrl} />
          </audio>
          <div className="mt-4 text-sm text-white/60">
            Voice uploads stay draft-only until the owner confirms them.
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
        Preview unavailable.
      </div>
    );
  }, [item, signedUrl]);

  if (gate.loading || loading) {
    return <div className="p-8 text-white/70">Loading item…</div>;
  }

  if (err && !item) {
    return <div className="p-8 text-red-200">{err}</div>;
  }

  if (!item) {
    return <div className="p-8 text-red-200">Pending review item not found.</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-white/45">Pending Review Item</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {item.source_filename || item.id}
            </h1>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {item.kind}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {item.status}
              </span>
              {item.draft_type ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {item.draft_type}
                </span>
              ) : null}
              <span className={`rounded-full border px-2.5 py-1 ${confidenceTone(item.confidence_score)}`}>
                Confidence: {item.confidence_score == null ? "—" : `${Math.round(Number(item.confidence_score) * 100)}%`}
              </span>
              {fastConfirmReady ? (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                  Ready now
                </span>
              ) : null}
              {hasBlockingFlags ? (
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-200">
                  Blocking flags
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/app/pending-review"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
            >
              Back to queue
            </a>

            {nav?.prevItemId ? (
              <button
                type="button"
                onClick={() => router.replace(`/app/pending-review/${nav.prevItemId}`)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Previous
              </button>
            ) : null}

            {nav?.nextPendingItemId ? (
              <button
                type="button"
                onClick={() => router.replace(`/app/pending-review/${nav.nextPendingItemId}`)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Next pending
              </button>
              
            ) : null}
            <button
  type="button"
  onClick={() => {
    const ok = window.confirm("Delete this upload from the active queue?");
    if (!ok) return;
    void doDelete({ comment: "Deleted from intake item detail page." });
  }}
  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/15 transition"
>
  Delete
</button>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {batchProgress ? (
          <div className="mb-5">
            <BatchProgressBar {...batchProgress} />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            {preview}

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-white/45">What we found</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] text-white/45">Amount</div>
                  <div className="mt-1 text-base font-semibold text-white/95">
                    {money(draft?.amount_cents, draft?.currency)}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] text-white/45">Vendor</div>
                  <div className="mt-1 text-base font-semibold text-white/95">
                    {draft?.vendor || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] text-white/45">Date</div>
                  <div className="mt-1 text-base font-semibold text-white/95">
                    {draft?.event_date || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] text-white/45">Suggested job</div>
                  <div className="mt-1 text-base font-semibold text-white/95">
                    {jobNameOverride || draft?.job_name || item.job_name || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] text-white/45">Description</div>
                <div className="mt-1 text-sm leading-relaxed text-white/80">
                  {draft?.description || "—"}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-white/45">Review state</div>

              <div
                className={`mt-4 rounded-xl border p-3 text-sm ${
                  fastConfirmReady
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    : hasBlockingFlags
                    ? "border-red-500/20 bg-red-500/10 text-red-100"
                    : "border-white/10 bg-white/5 text-white/75"
                }`}
              >
                {readyReason}
              </div>

              {validationFlags.length === 0 ? (
                <div className="mt-3 text-sm text-white/55">No validation flags yet.</div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {validationFlags.map((flag) => (
                    <span
                      key={flag}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        hasBlockingFlags
                          ? "border-red-500/20 bg-red-500/10 text-red-200"
                          : "border-white/10 bg-white/5 text-white/75"
                      }`}
                    >
                      {flagLabel(flag)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {validationFlags.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">Why this was flagged</div>
                <div className="mt-4 space-y-3">
                  {validationFlags.map((flag) => (
                    <div
                      key={flag}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="text-sm font-semibold text-white/90">{flagLabel(flag)}</div>
                      <div className="mt-1 text-sm leading-relaxed text-white/65">
                        {flagReason(flag)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(extractedText?.best_text || item.ocr_text || item.transcript_text) && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">Extracted evidence text</div>
                <div className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-white/70">
                  {extractedText?.best_text || item.ocr_text || item.transcript_text}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            {(draft?.draft_type === "overhead" || item.draft_type === "overhead") ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
                <div className="text-xs uppercase tracking-[0.14em] text-amber-400/70">Overhead item</div>

                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 text-xs text-white/50">Name *</label>
                    <input value={ohName} onChange={(e) => setOhName(e.target.value)} placeholder="e.g. Shop Rent, Ford F-150 Lease"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-white/15" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-xs text-white/50">Category</label>
                      <select value={ohCategory} onChange={(e) => setOhCategory(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15">
                        <option value="facility">Facility</option>
                        <option value="vehicle">Vehicle</option>
                        <option value="equipment">Equipment</option>
                        <option value="insurance">Insurance</option>
                        <option value="payroll">Payroll / Admin</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-xs text-white/50">Frequency</label>
                      <select value={ohFrequency} onChange={(e) => setOhFrequency(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15">
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 text-xs text-white/50">Amount ($) *</label>
                      <input type="number" min="0" step="0.01" value={ohAmount} onChange={(e) => setOhAmount(e.target.value)} placeholder="2000.00"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-white/15" />
                    </div>
                    <div>
                      <label className="block mb-1 text-xs text-white/50">Due day (1–28)</label>
                      <input type="number" min="1" max="28" value={ohDueDay} onChange={(e) => setOhDueDay(e.target.value)} placeholder="1"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-white/15" />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-xs text-white/50">Notes (optional)</label>
                    <textarea value={ohNotes} onChange={(e) => setOhNotes(e.target.value)} rows={2} placeholder="Any additional context…"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-2 focus:ring-white/15 resize-none" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={doConfirmOverhead} disabled={mutating}
                    className="flex-1 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 transition">
                    {mutating ? "Saving…" : "Add to Overhead"}
                  </button>
                  <button type="button" onClick={() => doSkip()} disabled={mutating}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50 transition">
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <ReviewConveyor
                itemId={item.id}
                itemKind={item.kind}
                sourceFilename={item.source_filename}
                validationFlags={validationFlags}
                initialDraft={{
                  amountCents: draft?.amount_cents != null ? String(draft.amount_cents) : "",
                  vendor: draft?.vendor || "",
                  description: draft?.description || "",
                  eventDate: draft?.event_date || "",
                  jobName: jobNameOverride || draft?.job_name || item.job_name || "",
                  currency: draft?.currency || "USD",
                  expenseCategory:
                    draft?.expense_category ||
                    classifyExpense(draft?.vendor, draft?.description).category ||
                    "",
                  isPersonal: draft?.is_personal ?? false,
                }}
                onConfirm={doConfirm}
                onSkip={doSkip}
                onDuplicate={doDuplicate}
                busy={mutating}
              />
            )}

            {draft?.draft_type !== "overhead" && item.draft_type !== "overhead" && (
              <JobSuggestionPicker
                suggestions={jobSuggestions}
                selectedJobName={jobNameOverride}
                onSelect={setJobNameOverride}
              />
            )}

            {draft?.draft_type !== "overhead" && item.draft_type !== "overhead" && <ExplainExpensePanel
              sourceFilename={item.source_filename}
              amountCents={draft?.amount_cents}
              currency={draft?.currency}
              vendor={draft?.vendor}
              description={draft?.description}
              eventDate={draft?.event_date}
              jobName={jobNameOverride || draft?.job_name || item.job_name}
              itemStatus={item.status}
              transactionId={
                latestConfirmReview?.after_payload?.transaction_id
                  ? String(latestConfirmReview.after_payload.transaction_id)
                  : null
              }
              confidenceScore={item.confidence_score}
              validationFlags={validationFlags}
            />}

            {parse ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">Parsing details</div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] text-white/45">Pipeline version</div>
                    <div className="mt-1 text-white/80">{String(parse.pipeline_version || "phase1")}</div>
                  </div>

                  {parse?.enrich?.explain_amount_source ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] text-white/45">Amount source</div>
                      <div className="mt-1 text-white/80">{String(parse.enrich.explain_amount_source)}</div>
                    </div>
                  ) : null}

                  {parse?.enrich?.explain_vendor_source ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] text-white/45">Vendor source</div>
                      <div className="mt-1 text-white/80">{String(parse.enrich.explain_vendor_source)}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs uppercase tracking-[0.14em] text-white/45">Review history</div>
              {reviews.length === 0 ? (
                <div className="mt-3 text-sm text-white/55">No review actions yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white/90">{review.action}</div>
                        <div className="text-[11px] text-white/45">{review.created_at}</div>
                      </div>
                      {review.comment ? (
                        <div className="mt-2 text-sm text-white/65">{review.comment}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}