"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

type UploadState = {
  loading: boolean;
  error: string | null;
  batchId: string | null;
  uploadedCount: number;
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
    else if (type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg)$/i.test(name)) audio++;
    else if (type === "application/pdf" || name.endsWith(".pdf")) pdfs++;
    else other++;
  }

  return { images, audio, pdfs, other };
}

export default function UploadsPage() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<UploadState>({
    loading: false,
    error: null,
    batchId: null,
    uploadedCount: 0,
  });

  const summary = useMemo(() => detectSummary(files), [files]);

  async function onUpload() {
    try {
      setState({ loading: true, error: null, batchId: null, uploadedCount: 0 });

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (!token) throw new Error("Missing session.");
      if (!files.length) throw new Error("Choose at least one file.");

      const form = new FormData();
      for (const file of files) form.append("files", file);

      const r = await fetch("/api/intake/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Upload failed.");
      }

      setState({
        loading: false,
        error: null,
        batchId: String(j.batchId),
        uploadedCount: Number(j.uploadedCount || 0),
      });
    } catch (e: any) {
      setState({
        loading: false,
        error: e?.message || "Upload failed.",
        batchId: null,
        uploadedCount: 0,
      });
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
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Upload receipts, voice, and PDFs</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65">
            Files upload first into a draft review lane. Nothing becomes truth until it is confirmed in Pending Review.
          </p>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-black/40 p-5">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
            <input
              type="file"
              multiple
              accept="image/*,audio/*,.pdf,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-white/80 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-white/90"
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

          {state.error && (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {state.error}
            </div>
          )}

          {state.batchId && (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
              Uploaded {state.uploadedCount} file(s).
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/app/pending-review`}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                >
                  Open Pending Review
                </a>
                <a
                  href={`/app/pending-review`}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
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
              disabled={state.loading || !files.length}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
            >
              {state.loading ? "Uploading…" : "Upload to Pending Review"}
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