// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\components\marketing\FAQ.tsx
"use client";

import { useMemo, useState } from "react";

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
              className="w-full flex items-start justify-between gap-4 text-left"
              onClick={() => setOpenIx(open ? null : ix)}
              aria-expanded={open}
            >
              <div className="text-sm md:text-base font-semibold text-white/90">
                {it.q}
              </div>
              <div className="mt-1 text-white/50">{open ? "−" : "+"}</div>
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
