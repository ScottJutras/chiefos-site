"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
};

const QUICK_PROMPTS = [
  "What needs my attention right now?",
  "Which jobs are making money?",
  "What is still waiting in Pending Review?",
  "What should I follow up on today?",
];

export default function ChiefDock({ open, onClose, initialQuery }: Props) {
  const [iframeSrc, setIframeSrc] = useState("/app/chief?embed=1");
  const hasInitializedRef = useRef(false);

  // Set iframe src once on first open — never change it so the conversation persists
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const q = String(initialQuery || "").trim();
      setIframeSrc(q ? `/app/chief?embed=1&q=${encodeURIComponent(q)}` : "/app/chief?embed=1");
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only shown when open */}
      {open && (
        <button
          type="button"
          aria-label="Minimize Chief"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px]"
        />
      )}

      {/* Panel — always mounted so the iframe (and conversation) is never destroyed */}
      <div
        className={[
          "fixed inset-0 z-50 flex items-end justify-end md:items-stretch",
          open ? "" : "hidden",
        ].join(" ")}
      >
        <aside
          className="
            flex h-[88vh] w-full flex-col overflow-hidden
            rounded-t-[28px] border border-white/10 bg-black shadow-[0_0_60px_rgba(0,0,0,0.55)]
            md:h-full md:max-w-[620px] md:rounded-none md:rounded-l-[28px] md:border-y-0 md:border-r-0 md:border-l
          "
        >
          <div className="flex items-center justify-center pt-2 md:hidden">
            <div className="h-1.5 w-14 rounded-full bg-white/20" />
          </div>

          <div className="border-b border-white/10 px-4 py-4 md:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                  Chief
                </div>
                <div className="mt-1 text-base font-semibold text-white/92">
                  Reason while the business stays visible
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Ask questions, keep context, and close when you are done.
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                Minimize
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <a
                  key={prompt}
                  href={`/app/chief?q=${encodeURIComponent(prompt)}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
                >
                  {prompt}
                </a>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-black">
            <iframe
              title="Chief"
              src={iframeSrc}
              className="h-full w-full bg-black"
            />
          </div>
        </aside>
      </div>
    </>
  );
}
