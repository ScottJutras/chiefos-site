"use client";

type Props = {
  sourceFilename?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  vendor?: string | null;
  description?: string | null;
  eventDate?: string | null;
  jobName?: string | null;
  itemStatus?: string | null;
  transactionId?: string | null;
  confidenceScore?: number | null;
  validationFlags?: string[];
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

export default function ExplainExpensePanel({
  sourceFilename,
  amountCents,
  currency,
  vendor,
  description,
  eventDate,
  jobName,
  itemStatus,
  transactionId,
  confidenceScore,
  validationFlags = [],
}: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="text-xs text-white/45">Explain this expense</div>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/45">Evidence</div>
          <div className="mt-1 text-sm text-white/85">{sourceFilename || "Uploaded file"}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/45">How ChiefOS sees it</div>
          <div className="mt-2 grid gap-2 text-sm text-white/75 md:grid-cols-2">
            <div>Amount: <span className="text-white/90 font-semibold">{money(amountCents, currency)}</span></div>
            <div>Vendor: <span className="text-white/90 font-semibold">{vendor || "—"}</span></div>
            <div>Date: <span className="text-white/90 font-semibold">{eventDate || "—"}</span></div>
            <div>Job: <span className="text-white/90 font-semibold">{jobName || "Unassigned"}</span></div>
            <div className="md:col-span-2">
              Description: <span className="text-white/90 font-semibold">{description || "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/45">Why this number is trusted</div>
          <div className="mt-2 text-sm leading-relaxed text-white/70">
            This expense stays draft-only until you confirm it. Once confirmed, ChiefOS writes one canonical expense
            row and preserves the review trail, source evidence, and final edited values.
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60">
              Status: {itemStatus || "—"}
            </span>
            <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60">
              Confidence: {confidenceScore == null ? "—" : `${Math.round(Number(confidenceScore) * 100)}%`}
            </span>
            {transactionId ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                Transaction: {transactionId}
              </span>
            ) : null}
          </div>

          {validationFlags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {validationFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200"
                >
                  {flag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}