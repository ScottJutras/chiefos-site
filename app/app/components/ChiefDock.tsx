"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChiefPageContext } from "./GlobalChiefDock";

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  pageContext?: ChiefPageContext;
};

const DEFAULT_PROMPTS = [
  "What needs my attention right now?",
  "Which jobs are making money?",
  "What is still waiting in Pending Review?",
  "What should I follow up on today?",
];

export default function ChiefDock({ open, onClose, initialQuery, pageContext }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasInitializedRef = useRef(false);
  const iframeSrcRef = useRef("/app/chief?embed=1");

  // Set iframe src once on first open — never change it so the conversation persists
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const q = String(initialQuery || "").trim();
      iframeSrcRef.current = q
        ? `/app/chief?embed=1&q=${encodeURIComponent(q)}`
        : "/app/chief?embed=1";
      // Force a re-render to apply the src (iframe only needs src set once)
      if (iframeRef.current) iframeRef.current.src = iframeSrcRef.current;
    }
  }, [open, initialQuery]);

  // Send page context to iframe via postMessage whenever it changes
  useEffect(() => {
    if (!pageContext || !open) return;
    // Small delay to ensure iframe has loaded
    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "chief-context", pageContext },
        window.location.origin
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [pageContext, open]);

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

  // Context-aware quick prompts
  const quickPrompts = useMemo(() => {
    if (pageContext?.job_name) {
      return [
        `How am I doing on ${pageContext.job_name}?`,
        `Is ${pageContext.job_name} profitable?`,
        `What have I spent on ${pageContext.job_name}?`,
        "What should I follow up on today?",
      ];
    }
    return DEFAULT_PROMPTS;
  }, [pageContext]);

  // Send a prompt to the iframe instead of navigating away
  function sendPrompt(prompt: string) {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "chief-prompt", prompt },
      window.location.origin
    );
  }

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
                  {pageContext?.job_name
                    ? `Viewing: ${pageContext.job_name}`
                    : "Your on-call CFO"}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Ask anything — Chief reads your live data.
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
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendPrompt(prompt)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 transition text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-black">
            <iframe
              ref={iframeRef}
              title="Chief"
              src={iframeSrcRef.current}
              className="h-full w-full bg-black"
            />
          </div>
        </aside>
      </div>
    </>
  );
}
