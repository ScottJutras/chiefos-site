"use client";

import { useMemo, useState } from "react";

type ReviewDraft = {
  amountCents: string;
  vendor: string;
  description: string;
  eventDate: string;
  jobName: string;
  currency: string;
};

type Props = {
  itemId: string;
  itemKind: string;
  sourceFilename?: string | null;
  initialDraft?: Partial<ReviewDraft>;
  validationFlags?: string[];
  onConfirm: (payload: {
    amountCents: number;
    vendor: string | null;
    description: string | null;
    eventDate: string | null;
    jobName: string | null;
    currency: string;
    edited: boolean;
  }) => Promise<void>;
  onSkip: (payload?: { comment?: string }) => Promise<void>;
  onDuplicate: (payload?: { duplicateOfItemId?: string; comment?: string }) => Promise<void>;
  busy?: boolean;
};

function centsToDisplay(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

export default function ReviewConveyor({
  itemId,
  itemKind,
  sourceFilename,
  initialDraft,
  validationFlags = [],
  onConfirm,
  onSkip,
  onDuplicate,
  busy = false,
}: Props) {
  const [amountCents, setAmountCents] = useState(centsToDisplay(initialDraft?.amountCents));
  const [vendor, setVendor] = useState(String(initialDraft?.vendor || ""));
  const [description, setDescription] = useState(String(initialDraft?.description || ""));
  const [eventDate, setEventDate] = useState(String(initialDraft?.eventDate || ""));
  const [jobName, setJobName] = useState(String(initialDraft?.jobName || ""));
  const [currency, setCurrency] = useState(String(initialDraft?.currency || "USD"));
  const [duplicateOfItemId, setDuplicateOfItemId] = useState("");
  const [comment, setComment] = useState("");

  const edited = useMemo(() => {
    return (
      String(initialDraft?.amountCents || "") !== amountCents ||
      String(initialDraft?.vendor || "") !== vendor ||
      String(initialDraft?.description || "") !== description ||
      String(initialDraft?.eventDate || "") !== eventDate ||
      String(initialDraft?.jobName || "") !== jobName ||
      String(initialDraft?.currency || "USD") !== currency
    );
  }, [amountCents, vendor, description, eventDate, jobName, currency, initialDraft]);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-white/45">Review conveyor</div>
          <div className="mt-1 text-sm font-semibold text-white/90">
            {sourceFilename || itemId}
          </div>
          <div className="mt-1 text-xs text-white/55">{itemKind}</div>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
          {edited ? "Edited" : "Unedited"}
        </div>
      </div>

      {validationFlags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {validationFlags.map((flag) => (
            <span
              key={flag}
              className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200"
            >
              {flag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs text-white/50">Amount (cents)</label>
          <input
            value={amountCents}
            onChange={(e) => setAmountCents(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="9435"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-white/50">Currency</label>
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="USD"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-white/50">Vendor</label>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Home Depot"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-white/50">Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-white/50">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Framing nails"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs text-white/50">Job</label>
          <input
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="Kitchen Remodel - Harris"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-xs text-white/45">Duplicate or skip</div>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-white/50">Duplicate of item id (optional)</label>
            <input
              value={duplicateOfItemId}
              onChange={(e) => setDuplicateOfItemId(e.target.value)}
              placeholder="Paste other intake item id"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50">Comment (optional)</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional review comment"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onConfirm({
              amountCents: Number(amountCents || 0),
              vendor: vendor.trim() || null,
              description: description.trim() || null,
              eventDate: eventDate || null,
              jobName: jobName.trim() || null,
              currency: currency.trim() || "USD",
              edited,
            })
          }
          className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
        >
          {edited ? "Edit + confirm" : "Confirm"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onSkip({ comment: comment.trim() || undefined })}
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
        >
          Skip
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onDuplicate({
              duplicateOfItemId: duplicateOfItemId.trim() || undefined,
              comment: comment.trim() || undefined,
            })
          }
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
        >
          Mark duplicate
        </button>
      </div>
    </section>
  );
}