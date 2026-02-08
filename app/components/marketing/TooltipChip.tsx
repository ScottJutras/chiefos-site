// app/components/marketing/TooltipChip.tsx
"use client";

import type { ReactNode } from "react";

export default function TooltipChip({
  children,
  tip,
  show = true,
  className = "",
}: {
  children: ReactNode;
  tip: string;
  show?: boolean; // allows "only when scrolled" behavior
  className?: string;
}) {
  return (
    <span className={["group relative inline-flex", className].join(" ").trim()}>
      {children}

      {show && (
        <span
          className={[
            "pointer-events-none hidden md:block",
            "absolute left-1/2 -translate-x-1/2 top-[calc(100%+10px)]",
            "whitespace-nowrap rounded-xl border border-white/10 bg-black/90 px-3 py-2",
            "text-[11px] font-medium text-white/70",
            "shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
            "opacity-0 translate-y-1 transition",
            "group-hover:opacity-100 group-hover:translate-y-0",
          ].join(" ")}
          aria-hidden="true"
        >
          {tip}
          <span
            className="absolute left-1/2 -translate-x-1/2 -top-1 h-2 w-2 rotate-45 border-l border-t border-white/10 bg-black/90"
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}
