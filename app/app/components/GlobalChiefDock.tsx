"use client";

import { useEffect, useState } from "react";
import ChiefDock from "./ChiefDock";

/**
 * Renders the persistent ChiefDock panel.
 * Must be placed OUTSIDE the sticky <header> in the layout so that
 * the header's backdrop-blur stacking context doesn't trap the
 * position:fixed panel inside it.
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
    <ChiefDock
      open={open}
      onClose={() => setOpen(false)}
      initialQuery={pendingQuery}
    />
  );
}
