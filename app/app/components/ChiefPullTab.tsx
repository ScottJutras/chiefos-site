"use client";

import { useEffect, useState } from "react";

/**
 * Floating vertical "Ask Chief" pull-tab anchored to the right edge.
 * Disappears while the Chief panel is open so the two don't overlap.
 */
export default function ChiefPullTab() {
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    function onOpen() { setPanelOpen(true); }
    function onClose() { setPanelOpen(false); }
    window.addEventListener("open-chief", onOpen);
    window.addEventListener("close-chief", onClose);
    return () => {
      window.removeEventListener("open-chief", onOpen);
      window.removeEventListener("close-chief", onClose);
    };
  }, []);

  if (panelOpen) return null;

  function open() {
    window.dispatchEvent(
      new CustomEvent("open-chief", {
        detail: { query: "", page: window.location.pathname },
      })
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Ask Chief"
      className="
        fixed right-0 top-1/2 z-40 -translate-y-1/2
        flex flex-col items-center justify-center gap-0.5
        w-8 rounded-l-xl border border-r-0 border-white/10
        bg-white/5 py-5 backdrop-blur-sm
        hover:bg-white/10 transition
        select-none
      "
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/50 leading-tight">Ask</span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/50 leading-tight">Chief</span>
    </button>
  );
}
