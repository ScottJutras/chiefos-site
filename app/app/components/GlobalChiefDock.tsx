"use client";

import { useEffect, useState } from "react";
import ChiefDock from "./ChiefDock";

/**
 * Renders the "Ask Chief" header button + the persistent ChiefDock panel.
 * Lives in the app layout so the dock (and its conversation) survives page navigation.
 *
 * Any component can open the dock with a pre-filled query by dispatching:
 *   window.dispatchEvent(new CustomEvent("open-chief", { detail: { query: "..." } }))
 */
export default function GlobalChiefDock() {
  const [open, setOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");

  useEffect(() => {
    function handler(e: Event) {
      const q = ((e as CustomEvent).detail?.query as string) || "";
      setPendingQuery(q);
      setOpen(true);
    }
    window.addEventListener("open-chief", handler);
    return () => window.removeEventListener("open-chief", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
      >
        Ask Chief
      </button>

      <ChiefDock
        open={open}
        onClose={() => setOpen(false)}
        initialQuery={pendingQuery}
      />
    </>
  );
}
