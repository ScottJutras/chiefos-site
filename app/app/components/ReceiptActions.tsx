"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

function labelFor(contentType?: string | null) {
  const ct = String(contentType || "").toLowerCase();
  // ✅ UX tweak you asked for:
  // image/pdf => Receipt
  // everything else (audio/ogg etc) => Attachment
  if (!ct) return "Receipt";
  if (ct.includes("image/") || ct.includes("pdf")) return "Receipt";
  return "Attachment";
}

function filenameFor(contentType?: string | null, txId?: number | string) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("pdf")) return `receipt-${txId || "file"}.pdf`;
  if (ct.includes("png")) return `receipt-${txId || "file"}.png`;
  if (ct.includes("jpeg") || ct.includes("jpg")) return `receipt-${txId || "file"}.jpg`;
  if (ct.includes("webp")) return `receipt-${txId || "file"}.webp`;
  if (ct.includes("audio/")) return `attachment-${txId || "file"}.ogg`;
  return `attachment-${txId || "file"}`;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

async function fetchReceiptBlob(transactionId: number, download: boolean) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Missing session. Please log in again.");
  }

  const url = `/api/receipts/${transactionId}${download ? "?download=1" : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const ct = res.headers.get("content-type") || "";

  // If JSON error, surface message cleanly
  if (ct.includes("application/json")) {
    const j = await res.json().catch(() => null);
    const msg = j?.message || j?.error || "Receipt failed.";
    throw new Error(msg);
  }

  if (!res.ok) {
    throw new Error(`Receipt failed (${res.status}).`);
  }

  const blob = await res.blob();
  const contentType = res.headers.get("content-type") || blob.type || "";
  return { blob, contentType };
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
  if (!mediaAssetId) return null;

  const [busy, setBusy] = useState<null | "view" | "download">(null);
  const label = labelFor(contentType);

  const onView = async () => {
    if (busy) return;
    try {
      setBusy("view");
      const { blob } = await fetchReceiptBlob(transactionId, false);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      // best-effort cleanup (delayed so the new tab can load it)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      alert(e?.message || "Receipt failed.");
    } finally {
      setBusy(null);
    }
  };

  const onDownload = async () => {
    if (busy) return;
    try {
      setBusy("download");
      const { blob, contentType: ctFromRes } = await fetchReceiptBlob(transactionId, true);
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filenameFor(ctFromRes || contentType, transactionId);
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (e: any) {
      alert(e?.message || "Receipt failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onView}
        disabled={!!busy}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50 transition"
        title={`View ${label.toLowerCase()}`}
      >
        <span aria-hidden="true">📎</span>
        {busy === "view" ? "Opening…" : label}
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={!!busy}
        className="inline-flex items-center rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50 transition"
        title={`Download ${label.toLowerCase()}`}
      >
        {busy === "download" ? "Downloading…" : "Download"}
      </button>
    </div>
  );
}