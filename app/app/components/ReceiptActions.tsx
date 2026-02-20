"use client";

import React from "react";

export default function ReceiptActions({
  transactionId,
  mediaAssetId,
  contentType,
}: {
  transactionId: number;
  mediaAssetId?: string | null;
  contentType?: string | null;
}) {
  if (!mediaAssetId) return null;

  const ct = String(contentType || "").toLowerCase();
  const isReceipt = !ct || ct.includes("image/") || ct.includes("pdf");
  const label = isReceipt ? "Receipt" : "Attachment";

  const base = `/api/receipts/${transactionId}`;
  const viewHref = base;
  const dlHref = `${base}?download=1`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={viewHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition"
        title={`View ${label.toLowerCase()}`}
      >
        <span aria-hidden="true">📎</span>
        {label}
      </a>

      <a
        href={dlHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
        title={`Download ${label.toLowerCase()}`}
      >
        Download
      </a>
    </div>
  );
}