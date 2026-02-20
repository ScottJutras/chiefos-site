// app/app/components/ReceiptActions.tsx
"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

function labelFromContentType(contentType?: string | null) {
  const ct = String(contentType || "").toLowerCase().trim();

  // No type stored → assume it’s a receipt image
  if (!ct) return "Receipt";

  // Explicit receipt types
  if (ct.startsWith("image/")) return "Receipt";
  if (ct === "application/pdf") return "Receipt";

  // Everything else (audio, unknown, etc.)
  return "Attachment";
}

function filenameFromHeaders(h: Headers, fallback: string) {
  const cd = h.get("content-disposition") || "";
  // naive parse: filename="..."
  const m = cd.match(/filename="([^"]+)"/i);
  return m?.[1] || fallback;
}

export default function ReceiptActions({
  transactionId,
  mediaAssetId,
  contentType,
}: {
  transactionId: number;
  mediaAssetId?: string | null;
  contentType?: string | null;
}) {
  const [busy, setBusy] = useState<null | "view" | "download">(null);

  if (!mediaAssetId) return null;

  const label = labelFromContentType(contentType);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function fetchBlob(download: boolean) {
    const token = await getToken();
    if (!token) throw new Error("Missing session. Please log in again.");

    const url = `/api/receipts/${encodeURIComponent(String(transactionId))}${download ? "?download=1" : ""}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const ct = resp.headers.get("content-type") || "";

    // If JSON error, show message
    if (ct.includes("application/json")) {
      const j = await resp.json().catch(() => null);
      throw new Error(j?.message || j?.error || "Receipt failed.");
    }

    if (!resp.ok) throw new Error(`Receipt failed (${resp.status}).`);

    const blob = await resp.blob();
    const objectUrl = URL.createObjectURL(blob);

    return {
      objectUrl,
      filename: filenameFromHeaders(resp.headers, `receipt-${transactionId}`),
    };
  }

  async function onView() {
    if (busy) return;
    try {
      setBusy("view");
      const { objectUrl } = await fetchBlob(false);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      // allow tab to load, then revoke
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (e: any) {
      alert(e?.message || "Failed to open receipt.");
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    if (busy) return;
    try {
      setBusy("download");
      const { objectUrl, filename } = await fetchBlob(true);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (e: any) {
      alert(e?.message || "Failed to download receipt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onView}
        disabled={!!busy}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition disabled:opacity-50"
        title={`View ${label.toLowerCase()}`}
      >
        <span aria-hidden="true">
  {label === "Receipt" ? "🧾" : "📎"}
</span>
        {busy === "view" ? "Opening…" : label}
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={!!busy}
        className="inline-flex items-center rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-50"
        title={`Download ${label.toLowerCase()}`}
      >
        {busy === "download" ? "Downloading…" : "Download"}
      </button>
    </div>
  );
}