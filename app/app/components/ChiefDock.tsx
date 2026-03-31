"use client";

import { useEffect, useRef, useState } from "react";
import type { ChiefPageContext } from "./GlobalChiefDock";

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  pageContext?: ChiefPageContext;
};

export default function ChiefDock({ open, onClose, initialQuery, pageContext }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hasInitializedRef = useRef(false);
  // useState so React properly sets the src attribute on the iframe DOM node
  const [iframeSrc, setIframeSrc] = useState("/app/chief?embed=1");

  // Set iframe src exactly once on first open — never update it so the conversation persists
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const q = String(initialQuery || "").trim();
      setIframeSrc(
        q ? `/app/chief?embed=1&q=${encodeURIComponent(q)}` : "/app/chief?embed=1"
      );
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


  return (
    <>
      {/* Backdrop — only shown when open */}
      {open && (
        <button
          type="button"
          aria-label="Minimize Chief"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/25"
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
          {/* Mobile drag handle + close button */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1 md:pt-3">
            <div className="h-1.5 w-14 rounded-full bg-white/20 md:hidden" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Minimize"
              className="ml-auto rounded-lg px-2 py-1 text-white/40 hover:text-white/70 hover:bg-white/5 transition text-lg font-light leading-none"
            >
              –
            </button>
          </div>

          <div className="min-h-0 flex-1 bg-black">
            <iframe
              ref={iframeRef}
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
