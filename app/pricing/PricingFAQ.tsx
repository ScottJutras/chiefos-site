// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\pricing\PricingFAQ.tsx
"use client";

import { useMemo, useState } from "react";

type FAQ = { q: string; a: string };

function FAQRow({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[rgba(212,168,83,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <div className="text-sm font-semibold text-[#E8E2D8]">{q}</div>

        <div
          className={[
            "inline-flex h-8 w-8 items-center justify-center rounded-xl",
            "border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] text-[#A8A090] transition",
            open ? "rotate-45" : "",
          ].join(" ")}
          aria-hidden="true"
        >
          +
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 -mt-2 text-sm text-[#A8A090] leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

export default function PricingFAQ({
  items,
  defaultOpenIndex = 0,
}: {
  items: FAQ[];
  defaultOpenIndex?: number;
}) {
  const safeDefault = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return -1;
    const i = Number.isFinite(defaultOpenIndex) ? defaultOpenIndex : 0;
    return Math.min(Math.max(i, 0), items.length - 1);
  }, [items, defaultOpenIndex]);

  const [openIndex, setOpenIndex] = useState<number>(safeDefault);

  if (!items?.length) return null;

  return (
    <div className="grid gap-3">
      {items.map((x, i) => (
        <FAQRow
          key={x.q}
          q={x.q}
          a={x.a}
          open={i === openIndex}
          onToggle={() => setOpenIndex((cur) => (cur === i ? -1 : i))}
        />
      ))}
    </div>
  );
}