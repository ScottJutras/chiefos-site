"use client";

import { useEffect, useRef, useState } from "react";
import { useSupplierGate } from "@/lib/useSupplierGate";
import { apiFetch } from "@/lib/apiFetch";

type ParsePreview = {
  parse_key: string;
  added: number;
  updated: number;
  unchanged: number;
  errors: { row: number; message: string }[];
};

type UploadEntry = {
  id: string;
  created_at: string;
  status: string;
  rows_added: number;
  rows_updated: number;
  rows_unchanged: number;
  rows_errored: number;
  filename: string | null;
};

type Step = "upload" | "preview" | "done";

export default function SupplierUploadPage() {
  const gate = useSupplierGate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [applied, setApplied] = useState<{ added: number; updated: number; unchanged: number } | null>(null);
  const [history, setHistory] = useState<UploadEntry[]>([]);

  useEffect(() => {
    if (!gate.supplierId) return;
    loadHistory();
  }, [gate.supplierId]);

  async function loadHistory() {
    try {
      const data = await apiFetch("/api/supplier/upload/history");
      setHistory(data.uploads ?? []);
    } catch {}
  }

  function onFileChange(f: File | null) {
    if (!f) return;
    const ok = f.name.endsWith(".xlsx") || f.name.endsWith(".csv") || f.name.endsWith(".xls");
    if (!ok) {
      setParseErr("Please upload an .xlsx or .csv file.");
      return;
    }
    setFile(f);
    setParseErr(null);
  }

  async function parsefile() {
    if (!file) return;
    setParsing(true);
    setParseErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      // Need to call with auth token but FormData body — use apiFetch with manual approach
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch("/api/supplier/upload/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || data.message || "Parse failed.");

      setPreview(data);
      setStep("preview");
    } catch (e: any) {
      setParseErr(e?.message || "Parse failed.");
    } finally {
      setParsing(false);
    }
  }

  async function applyUpload() {
    if (!preview?.parse_key) return;
    setApplying(true);
    try {
      const data = await apiFetch("/api/supplier/upload/apply", {
        method: "POST",
        body: JSON.stringify({ parse_key: preview.parse_key }),
      });
      setApplied({
        added: data.added ?? 0,
        updated: data.updated ?? 0,
        unchanged: data.unchanged ?? 0,
      });
      setStep("done");
      void loadHistory();
    } catch (e: any) {
      setParseErr(e?.message || "Apply failed.");
      setStep("preview");
    } finally {
      setApplying(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setApplied(null);
    setParseErr(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (gate.loading) {
    return <div className="py-12 text-center text-sm text-white/40">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Upload price list</h1>
        <a href="/supplier/catalog" className="text-sm text-white/40 hover:text-white">
          ← Back to catalog
        </a>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "preview", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-white/20">→</span>}
            <span className={step === s ? "text-white font-medium" : "text-white/30"}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFileChange(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
              dragOver ? "border-white/40 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            <svg className="mb-3 h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm font-medium text-white/70">
              {file ? file.name : "Drop your spreadsheet here or click to browse"}
            </p>
            <p className="mt-1 text-xs text-white/30">.xlsx or .csv</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.xls"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />

          {parseErr && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{parseErr}</div>
          )}

          <button
            onClick={parsefile}
            disabled={!file || parsing}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            {parsing ? "Parsing..." : "Parse spreadsheet"}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PreviewStat label="New products" value={preview.added} color="emerald" />
            <PreviewStat label="Updated" value={preview.updated} color="blue" />
            <PreviewStat label="Unchanged" value={preview.unchanged} color="default" />
            <PreviewStat label="Errors" value={preview.errors.length} color={preview.errors.length > 0 ? "red" : "default"} />
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="mb-2 text-sm font-medium text-red-400">Rows with errors (will be skipped)</p>
              <ul className="space-y-1">
                {preview.errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-xs text-red-300/70">Row {e.row}: {e.message}</li>
                ))}
                {preview.errors.length > 10 && (
                  <li className="text-xs text-red-300/50">...and {preview.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          {parseErr && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{parseErr}</div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white">
              Cancel
            </button>
            <button
              onClick={applyUpload}
              disabled={applying}
              className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {applying ? "Applying..." : `Apply changes (${preview.added + preview.updated} rows)`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && applied && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <p className="text-lg font-bold text-emerald-400">Upload complete</p>
            <p className="mt-1 text-sm text-emerald-300/70">
              {applied.added} added · {applied.updated} updated · {applied.unchanged} unchanged
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white">
              Upload another
            </button>
            <a
              href="/supplier/catalog"
              className="flex-1 rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-black"
            >
              View catalog
            </a>
          </div>
        </div>
      )}

      {/* Upload history */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/50">Upload history</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-2 text-left text-xs text-white/40">Date</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40">File</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40">Status</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40">Added</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40">Updated</th>
                  <th className="px-4 py-2 text-left text-xs text-white/40">Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-white/50">{new Date(h.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-white/70">{h.filename || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        h.status === "complete" ? "bg-emerald-500/20 text-emerald-400" :
                        h.status === "error" ? "bg-red-500/20 text-red-400" :
                        "bg-white/10 text-white/40"
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-white/50">{h.rows_added}</td>
                    <td className="px-4 py-2 text-white/50">{h.rows_updated}</td>
                    <td className="px-4 py-2 text-white/50">{h.rows_errored}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewStat({ label, value, color }: { label: string; value: number; color: "emerald" | "blue" | "red" | "default" }) {
  const cls = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    red: "border-red-500/20 bg-red-500/10 text-red-400",
    default: "border-white/10 bg-white/5 text-white/70",
  }[color];

  return (
    <div className={`rounded-xl border p-3 text-center ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs opacity-70">{label}</p>
    </div>
  );
}
