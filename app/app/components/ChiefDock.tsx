"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
};

export default function ChiefDock({ open, onClose, initialQuery }: Props) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const src = initialQuery?.trim()
    ? `/app/chief?q=${encodeURIComponent(initialQuery.trim())}`
    : "/app/chief";

  return (
    <>
      <button
        type="button"
        aria-label="Close Chief"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]"
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-white/10 bg-black shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Chief</div>
            <div className="mt-1 text-sm font-semibold text-white/90">
              Ask without leaving your workspace
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <iframe
            title="Chief"
            src={src}
            className="h-full w-full bg-black"
          />
        </div>
      </aside>
    </>
  );
}