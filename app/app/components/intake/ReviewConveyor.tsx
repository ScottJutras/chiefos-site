"use client";

import { useMemo, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/expense/categories";

type ReviewDraft = {
  amountCents: string;
  vendor: string;
  description: string;
  eventDate: string;
  jobName: string;
  currency: string;
  expenseCategory: string;
  isPersonal: boolean;
  payeeName: string;
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
    expenseCategory: string | null;
    isPersonal: boolean;
    payeeName: string | null;
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

function formatFlag(flag: string) {
  return String(flag || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function flagSeverity(flag: string) {
  const hardBlock = new Set([
    "missing_amount",
    "missing_vendor",
    "missing_date",
    "job_unresolved",
    "job_ambiguous",
    "possible_duplicate_attachment",
    "possible_duplicate_content",
    "unsupported_file_type",
  ]);

  return hardBlock.has(String(flag || "")) ? "hard" : "soft";
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
  const [expenseCategory, setExpenseCategory] = useState(String(initialDraft?.expenseCategory || ""));
  const [isPersonal, setIsPersonal] = useState(initialDraft?.isPersonal ?? false);
  const [payeeName, setPayeeName] = useState(String(initialDraft?.payeeName || ""));
  const [duplicateOfItemId, setDuplicateOfItemId] = useState("");
  const [comment, setComment] = useState("");

  const edited = useMemo(() => {
    return (
      String(initialDraft?.amountCents || "") !== amountCents ||
      String(initialDraft?.vendor || "") !== vendor ||
      String(initialDraft?.description || "") !== description ||
      String(initialDraft?.eventDate || "") !== eventDate ||
      String(initialDraft?.jobName || "") !== jobName ||
      String(initialDraft?.currency || "USD") !== currency ||
      String(initialDraft?.expenseCategory || "") !== expenseCategory ||
      (initialDraft?.isPersonal ?? false) !== isPersonal ||
      String(initialDraft?.payeeName || "") !== payeeName
    );
  }, [amountCents, vendor, description, eventDate, jobName, currency, expenseCategory, isPersonal, initialDraft]);

  const hardFlags = useMemo(
    () => validationFlags.filter((flag) => flagSeverity(flag) === "hard"),
    [validationFlags]
  );

  const softFlags = useMemo(
    () => validationFlags.filter((flag) => flagSeverity(flag) === "soft"),
    [validationFlags]
  );

  const hasAmount = Number(amountCents || 0) > 0;
  const hasVendor = vendor.trim().length > 0;
  const hasDate = eventDate.trim().length > 0;
  const hasJob = jobName.trim().length > 0;
  const hasCurrency = currency.trim().length > 0;

  const readyForFastConfirm = useMemo(() => {
    if (!hasAmount || !hasVendor || !hasDate || !hasJob || !hasCurrency) return false;
    if (hardFlags.length > 0) return false;
    return true;
  }, [hasAmount, hasVendor, hasDate, hasJob, hasCurrency, hardFlags.length]);

  const confirmLabel = readyForFastConfirm
    ? edited
      ? "Edit + confirm now"
      : "Confirm now"
    : edited
    ? "Edit + confirm"
    : "Confirm";

  const confirmHint = readyForFastConfirm
    ? "This draft looks structurally ready. Review and confirm."
    : !hasJob
    ? "Add a job to unlock fast confirm."
    : !hasAmount || !hasVendor || !hasDate
    ? "Complete the missing fields before confirming."
    : hardFlags.length > 0
    ? "This item still has blocking review flags."
    : "Review this draft before confirming.";

  function buildConfirmPayload() {
    return {
      amountCents: Number(amountCents || 0),
      vendor: vendor.trim() || null,
      description: description.trim() || null,
      eventDate: eventDate || null,
      jobName: jobName.trim() || null,
      currency: currency.trim() || "USD",
      expenseCategory: expenseCategory.trim() || null,
      isPersonal,
      payeeName: expenseCategory === "subcontractors" ? payeeName.trim() || null : null,
      edited,
    };
  }

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

        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
            {edited ? "Edited" : "Unedited"}
          </div>

          {readyForFastConfirm ? (
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
              Ready now
            </div>
          ) : (
            <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
              Needs review
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-4 rounded-2xl border p-4 ${
          readyForFastConfirm
            ? "border-emerald-500/20 bg-emerald-500/10"
            : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              className={`text-xs uppercase tracking-[0.12em] ${
                readyForFastConfirm ? "text-emerald-200/70" : "text-white/45"
              }`}
            >
              Confirm state
            </div>
            <div
              className={`mt-1 text-sm font-semibold ${
                readyForFastConfirm ? "text-emerald-100" : "text-white/90"
              }`}
            >
              {readyForFastConfirm ? "Ready for one-tap confirm" : "Needs owner review first"}
            </div>
            <div className="mt-1 text-xs text-white/60">{confirmHint}</div>
          </div>

          <button
            type="button"
            disabled={busy || !readyForFastConfirm}
            onClick={() => onConfirm(buildConfirmPayload())}
            className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${
              readyForFastConfirm
                ? "bg-white text-black hover:bg-white/90"
                : "border border-white/10 bg-white/5 text-white/70"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>

      {validationFlags.length > 0 && (
        <div className="mt-4 space-y-3">
          {hardFlags.length > 0 ? (
            <div>
              <div className="mb-2 text-xs text-white/45">Blocking flags</div>
              <div className="flex flex-wrap gap-2">
                {hardFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-200"
                  >
                    {formatFlag(flag)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {softFlags.length > 0 ? (
            <div>
              <div className="mb-2 text-xs text-white/45">Review flags</div>
              <div className="flex flex-wrap gap-2">
                {softFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200"
                  >
                    {formatFlag(flag)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
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
            className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm text-white outline-none ${
              hasJob
                ? "border-white/10 bg-black/40"
                : "border-amber-400/20 bg-amber-500/10"
            }`}
          />
          {!hasJob ? (
            <div className="mt-2 text-xs text-amber-200">
              Job is still required before fast confirm is allowed.
            </div>
          ) : null}
        </div>

        {/* Category + Business/Personal side by side */}
        <div>
          <label className="block text-xs text-white/50">
            Category
            {expenseCategory ? null : (
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                auto-suggested
              </span>
            )}
          </label>
          <select
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">— Select category —</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {expenseCategory === "subcontractors" && (
          <div className="md:col-span-2">
            <label className="block text-xs text-white/50">
              Payee name
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                T4A / 1099 required
              </span>
            </label>
            <input
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder="Jane Smith or ABC Subcontracting Ltd."
              className="mt-1 w-full rounded-xl border border-amber-400/20 bg-black/40 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-white/50">Type</label>
          <div className="mt-1 flex rounded-xl border border-white/10 bg-black/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPersonal(false)}
              className={[
                "flex-1 px-3 py-2 text-sm font-medium transition",
                !isPersonal
                  ? "bg-white text-black"
                  : "text-white/60 hover:bg-white/5",
              ].join(" ")}
            >
              Business
            </button>
            <button
              type="button"
              onClick={() => setIsPersonal(true)}
              className={[
                "flex-1 px-3 py-2 text-sm font-medium transition",
                isPersonal
                  ? "bg-amber-400 text-black"
                  : "text-white/60 hover:bg-white/5",
              ].join(" ")}
            >
              Personal
            </button>
          </div>
          {isPersonal ? (
            <div className="mt-2 text-xs text-amber-200">
              Personal expenses are excluded from your accountant export.
            </div>
          ) : null}
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
          onClick={() => onConfirm(buildConfirmPayload())}
          className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
        >
          {busy ? "Working…" : confirmLabel}
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
