"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import ReviewConveyor from "@/app/app/components/intake/ReviewConveyor";
import ExplainExpensePanel from "@/app/app/components/intake/ExplainExpensePanel";
import BatchProgressBar from "@/app/app/components/intake/BatchProgressBar";
import JobSuggestionPicker from "@/app/app/components/intake/JobSuggestionPicker";

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
  validation_flags: string[];
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

      const j = (await r.json().catch(() => ({}))) as Partial<ItemDetailResponse> & { ok?: boolean; error?: string };
      if (!r.ok || !j?.ok || !j.item) {
        throw new Error(j?.error || "Failed to load item.");
      }

      setItem(j.item);
      setDraft(j.draft || null);
      setReviews(Array.isArray(j.reviews) ? j.reviews : []);
      setBatchProgress(j.batchProgress || null);
      setNav(j.nav || null);
      setJobSuggestions(Array.isArray(j.jobSuggestions) ? j.jobSuggestions : []);
      setJobNameOverride(String(j.draft?.job_name || j.item.job_name || ""));

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

  async function doConfirm(payload: {
    amountCents: number;
    vendor: string | null;
    description: string | null;
    eventDate: string | null;
    jobName: string | null;
    currency: string;
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
            Voice uploads remain draft-only here until transcript + owner review.
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
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Confidence: {item.confidence_score == null ? "—" : `${Math.round(Number(item.confidence_score) * 100)}%`}
              </span>
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
          <section>{preview}</section>

          <aside className="space-y-4">
            <ReviewConveyor
              itemId={item.id}
              itemKind={item.kind}
              sourceFilename={item.source_filename}
              validationFlags={draft?.validation_flags || []}
              initialDraft={{
                amountCents: draft?.amount_cents != null ? String(draft.amount_cents) : "",
                vendor: draft?.vendor || "",
                description: draft?.description || "",
                eventDate: draft?.event_date || "",
                jobName: jobNameOverride || draft?.job_name || item.job_name || "",
                currency: draft?.currency || "USD",
              }}
              onConfirm={doConfirm}
              onSkip={doSkip}
              onDuplicate={doDuplicate}
              busy={mutating}
            />

            <JobSuggestionPicker
              suggestions={jobSuggestions}
              selectedJobName={jobNameOverride}
              onSelect={setJobNameOverride}
            />

            <ExplainExpensePanel
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
              validationFlags={draft?.validation_flags || []}
            />

            {(item.ocr_text || item.transcript_text) && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="text-xs text-white/45">Extracted text</div>
                <div className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                  {item.ocr_text || item.transcript_text}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs text-white/45">Review history</div>
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