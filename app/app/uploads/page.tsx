"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

type UploadPhase = "idle" | "uploading" | "processing" | "done" | "error";

type UploadState = {
  phase: UploadPhase;
  error: string | null;
  batchId: string | null;
  uploadedCount: number;
  processedCount: number;
  pendingCount: number;
  duplicateCount: number;
  skippedCount: number;
  confirmedCount: number;
};

function detectSummary(files: File[]) {
  let images = 0;
  let audio = 0;
  let pdfs = 0;
  let other = 0;

  for (const f of files) {
    const type = String(f.type || "").toLowerCase();
    const name = String(f.name || "").toLowerCase();

    if (type.startsWith("image/")) images++;
    else if (type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(name)) audio++;
    else if (type === "application/pdf" || name.endsWith(".pdf")) pdfs++;
    else other++;
  }

  return { images, audio, pdfs, other };
}

function phaseLabel(phase: UploadPhase) {
  switch (phase) {
    case "uploading":
      return "Uploading files…";
    case "processing":
      return "Building review drafts…";
    case "done":
      return "Upload complete";
    case "error":
      return "Something went wrong";
    default:
      return "Ready";
  }
}

export default function UploadsPage() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>({
    phase: "idle",
    error: null,
    batchId: null,
    uploadedCount: 0,
    processedCount: 0,
    pendingCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    confirmedCount: 0,
  });

  const summary = useMemo(() => detectSummary(files), [files]);
  const busy = state.phase === "uploading" || state.phase === "processing";

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function onUpload() {
    try {
      setState({
        phase: "uploading",
        error: null,
        batchId: null,
        uploadedCount: 0,
        processedCount: 0,
        pendingCount: 0,
        duplicateCount: 0,
        skippedCount: 0,
        confirmedCount: 0,
      });

      const token = await getToken();
      if (!token) throw new Error("Missing session.");
      if (!files.length) throw new Error("Choose at least one file.");

      const form = new FormData();
      for (const file of files) form.append("files", file);

      const uploadRes = await fetch("/api/intake/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadJson?.ok) {
        throw new Error(uploadJson?.error || "Upload failed.");
      }

      const batchId = String(uploadJson.batchId || "").trim();
      if (!batchId) throw new Error("Upload succeeded but no batchId was returned.");

      setState((prev) => ({
        ...prev,
        phase: "processing",
        batchId,
        uploadedCount: Number(uploadJson.uploadedCount || 0),
      }));

      const processRes = await fetch("/api/intake/process", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ batchId }),
      });

      const processJson = await processRes.json().catch(() => ({}));
      if (!processRes.ok || !processJson?.ok) {
        throw new Error(processJson?.error || "Upload succeeded but processing failed.");
      }

      setState({
        phase: "done",
        error: null,
        batchId,
        uploadedCount: Number(uploadJson.uploadedCount || 0),
        processedCount: Number(processJson.processedCount || 0),
        pendingCount: Number(processJson.pendingCount || 0),
        duplicateCount: Number(processJson.duplicateCount || 0),
        skippedCount: Number(processJson.skippedCount || 0),
        confirmedCount: Number(processJson.confirmedCount || 0),
      });

      setFiles([]);
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: e?.message || "Upload failed.",
      }));
    }
  }

  if (gate.loading) {
    return <div className="p-8 text-white/70">Loading uploads…</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-white/45">Bulk Intake</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Upload receipts, voice, and PDFs
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65">
            Files upload into a draft review lane first. Nothing becomes truth until it is confirmed in Pending Review.
          </p>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-black/40 p-5">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
            <input
              type="file"
              multiple
              accept="image/*,audio/*,.pdf,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              disabled={busy}
              className="block w-full text-sm text-white/80 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-white/90 disabled:opacity-50"
            />

            <div className="mt-4 text-sm text-white/60">
              Supported in Phase 1: images, audio, PDFs.
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Files</div>
                <div className="mt-2 text-2xl font-semibold">{files.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Images</div>
                <div className="mt-2 text-2xl font-semibold">{summary.images}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">Voice</div>
                <div className="mt-2 text-2xl font-semibold">{summary.audio}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/45">PDFs</div>
                <div className="mt-2 text-2xl font-semibold">{summary.pdfs}</div>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            <div className="font-medium text-white/90">{phaseLabel(state.phase)}</div>
            {state.phase === "processing" ? (
              <div className="mt-1 text-white/60">
                Extracting evidence and building review drafts now.
              </div>
            ) : null}
          </div>

          {state.error && (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {state.error}
            </div>
          )}

          {state.batchId && state.phase === "done" && (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
              Uploaded {state.uploadedCount} file(s). Processed {state.processedCount} item(s).
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-400/15 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/70">Pending Review</div>
                  <div className="mt-1 text-xl font-semibold">{state.pendingCount}</div>
                </div>
                <div className="rounded-xl border border-emerald-400/15 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/70">Duplicates</div>
                  <div className="mt-1 text-xl font-semibold">{state.duplicateCount}</div>
                </div>
                <div className="rounded-xl border border-emerald-400/15 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/70">Skipped</div>
                  <div className="mt-1 text-xl font-semibold">{state.skippedCount}</div>
                </div>
                <div className="rounded-xl border border-emerald-400/15 bg-black/20 p-3">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/70">Confirmed</div>
                  <div className="mt-1 text-xl font-semibold">{state.confirmedCount}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/app/pending-review"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                >
                  Open Pending Review
                </a>
                <a
                  href="/app/pending-review"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
                >
                  Review later
                </a>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onUpload()}
              disabled={busy || !files.length}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
            >
              {state.phase === "uploading"
                ? "Uploading…"
                : state.phase === "processing"
                  ? "Processing…"
                  : "Upload to Pending Review"}
            </button>

            <a
              href="/app/pending-review"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Go to Pending Review
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}