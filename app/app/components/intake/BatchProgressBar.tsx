"use client";

type Props = {
  total: number;
  pending: number;
  persisted: number;
  skipped: number;
  duplicate: number;
  failed?: number;
  currentIndex?: number;
};

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (n / total) * 100));
}

export default function BatchProgressBar({
  total,
  pending,
  persisted,
  skipped,
  duplicate,
  failed = 0,
  currentIndex = 1,
}: Props) {
  const done = persisted + skipped + duplicate + failed;
  const donePct = pct(done, total);
  const persistedPct = pct(persisted, total);
  const skippedPct = pct(skipped, total);
  const duplicatePct = pct(duplicate, total);
  const failedPct = pct(failed, total);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-white/45">Batch progress</div>
          <div className="mt-1 text-sm font-semibold text-white/90">
            Item {Math.min(currentIndex, Math.max(total, 1))} of {total || 0}
          </div>
        </div>

        <div className="text-right text-xs text-white/50">
          <div>{done} completed</div>
          <div>{pending} pending</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div className="relative h-3 w-full">
          <div className="absolute inset-y-0 left-0 bg-emerald-400/80" style={{ width: `${persistedPct}%` }} />
          <div
            className="absolute inset-y-0 bg-amber-400/75"
            style={{ left: `${persistedPct}%`, width: `${skippedPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-sky-400/75"
            style={{ left: `${persistedPct + skippedPct}%`, width: `${duplicatePct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-red-400/75"
            style={{ left: `${persistedPct + skippedPct + duplicatePct}%`, width: `${failedPct}%` }}
          />
          <div className="absolute inset-y-0 right-0 bg-white/10" style={{ width: `${100 - donePct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] text-white/45">Total</div>
          <div className="mt-1 text-lg font-semibold text-white/90">{total}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-emerald-500/10 p-3">
          <div className="text-[11px] text-white/45">Confirmed</div>
          <div className="mt-1 text-lg font-semibold text-emerald-200">{persisted}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-amber-500/10 p-3">
          <div className="text-[11px] text-white/45">Skipped</div>
          <div className="mt-1 text-lg font-semibold text-amber-200">{skipped}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-sky-500/10 p-3">
          <div className="text-[11px] text-white/45">Duplicate</div>
          <div className="mt-1 text-lg font-semibold text-sky-200">{duplicate}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] text-white/45">Pending</div>
          <div className="mt-1 text-lg font-semibold text-white/90">{pending}</div>
        </div>
      </div>
    </section>
  );
}