// app/components/marketing/FAQ.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function FAQ({
  items,
}: {
  items: Array<{ q: string; a: string }>;
}) {
  const [openIx, setOpenIx] = useState<number | null>(0);
  const safe = useMemo(() => items || [], [items]);

  return (
    <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
      {safe.map((it, ix) => {
        const open = openIx === ix;
        return (
          <div key={it.q} className="p-5">
            <button
              className="w-full flex items-start justify-between gap-4 text-left group"
              onClick={() => setOpenIx(open ? null : ix)}
              aria-expanded={open}
            >
              <div className="text-sm md:text-base font-semibold text-white/90 group-hover:text-white transition">
                {it.q}
              </div>
              <div className="mt-1 text-white/50 group-hover:text-white/70 transition">
                {open ? "−" : "+"}
              </div>
            </button>
            {open && (
              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                {it.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Subtle animated counter for “expensive” feel (not hypey). */
export function StatCounter({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    const start = performance.now();
    const dur = 650;
    const from = 0;
    const to = value;

    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value]);

  return (
    <div
      ref={(node) => {
        ref.current = node;
      }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {n}
        {suffix || ""}
      </div>
    </div>
  );
}

/** Small signature “Ask Chief” interaction (1 module only = premium). */
export function AskChiefDemo() {
  const presets = [
    {
      q: "Chief, how much am I making on Job 18 Main St?",
      a: [
        { k: "Revenue", v: "$9,800" },
        { k: "Costs", v: "$5,420" },
        { k: "Profit so far", v: "$4,380" },
        { k: "Why", v: "Labor is running high due to two long drive days." },
      ],
    },
    {
      q: "Show me the Home Depot receipt from last week.",
      a: [
        { k: "Found", v: "Home Depot • $187 • Job 18 Main St" },
        { k: "Evidence", v: "Receipt image saved and searchable." },
      ],
    },
    {
      q: "What did we spend on gas this month?",
      a: [
        { k: "Total", v: "$642" },
        { k: "Notes", v: "Most purchases clustered around 3 long drive days." },
      ],
    },
  ];

  const [active, setActive] = useState(0);

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-white/50">Interactive demo</div>
          <div className="mt-1 text-sm font-semibold text-white/90">Ask Chief</div>
          <div className="mt-1 text-xs text-white/60">
            Preset questions → explainable answers (no guessing).
          </div>
        </div>
        <div className="hidden md:block text-xs text-white/50">
          “Understanding &gt; dashboards”
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-12">
        <div className="md:col-span-5 flex flex-col gap-2">
          {presets.map((p, ix) => (
            <button
              key={p.q}
              onClick={() => setActive(ix)}
              className={[
                "text-left rounded-2xl border px-4 py-3 transition",
                "hover:bg-white/5 hover:-translate-y-[1px] active:translate-y-0",
                ix === active
                  ? "border-white/20 bg-white/5"
                  : "border-white/10 bg-black/30",
              ].join(" ")}
            >
              <div className="text-xs text-white/60">Tap to ask</div>
              <div className="mt-1 text-sm font-semibold text-white/90">{p.q}</div>
            </button>
          ))}
        </div>

        <div className="md:col-span-7">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">Chief replies</div>

            <div className="mt-3 space-y-2">
              {presets[active].a.map((row) => (
                <div
                  key={row.k}
                  className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="text-xs text-white/60">{row.k}</div>
                  <div className="text-sm text-white/85 text-right">{row.v}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Answers are grounded in your logs: time, receipts, revenue — attached to jobs.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
