"use client";

import { useEffect, useState } from "react";
import ChiefDock from "./ChiefDock";

export type ChiefPageContext = {
  page?: string;
  job_id?: number | string | null;
  job_name?: string;
  job_no?: number | string | null;
} | null;

/**
 * Renders the persistent ChiefDock panel.
 * Must be placed OUTSIDE the sticky <header> in the layout so that
 * the header's backdrop-blur stacking context doesn't trap the
 * position:fixed panel inside it.
 *
 * Any component can open the dock with a pre-filled query and page context:
 *   window.dispatchEvent(new CustomEvent("open-chief", {
 *     detail: { query: "...", page: "/app/jobs/123", job_name: "257 Main St", job_no: 1556 }
 *   }))
 */
export default function GlobalChiefDock() {
  const [open, setOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const [pageContext, setPageContext] = useState<ChiefPageContext>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      const q = (detail.query as string) || "";
      setPendingQuery(q);
      setPageContext({
        page: (detail.page as string) || undefined,
        job_id: detail.job_id ?? null,
        job_name: (detail.job_name as string) || undefined,
        job_no: detail.job_no ?? null,
      });
      setOpen(true);
    }
    window.addEventListener("open-chief", handler);
    return () => window.removeEventListener("open-chief", handler);
  }, []);

  function handleClose() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("close-chief"));
  }

  return (
    <ChiefDock
      open={open}
      onClose={handleClose}
      initialQuery={pendingQuery}
      pageContext={pageContext}
    />
  );
}
