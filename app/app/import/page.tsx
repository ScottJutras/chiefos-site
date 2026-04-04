"use client";

import React, { useCallback, useRef, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportKind = "expense" | "revenue" | "time";

type ValidRow = Record<string, unknown>;
type InvalidRow = { row: Record<string, string>; errors: string[] };

type Step = "upload" | "preview" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chip(cls: string) {
  return ["inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", cls].join(" ");
}

function moneyFmt(cents: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

function formatRowValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (key === "amount_cents" && typeof val === "number") return `$${moneyFmt(val)}`;
  if (key === "hours"        && typeof val === "number") return val.toFixed(2) + "h";
  return String(val);
}

const KIND_LABELS: Record<ImportKind, string> = {
  expense: "Expenses",
  revenue: "Revenue",
  time:    "Time Entries",
};

const KIND_DESCRIPTIONS: Record<ImportKind, string> = {
  expense: "Costs, purchases, materials, subcontractor payments",
  revenue: "Payments received, invoices, deposits",
  time:    "Employee hours, shifts, labour records",
};

const COLUMN_ORDER: Record<ImportKind, string[]> = {
  expense: ["date", "amount_cents", "vendor",  "category", "description", "job_name"],
  revenue: ["date", "amount_cents", "source",  "category", "description", "job_name"],
  time:    ["date", "employee_name", "hours",  "start_at_utc", "end_at_utc", "job_name"],
};

const SAMPLE_CSV: Record<ImportKind, string> = {
  expense: `date,amount,vendor,category,description,job_name\n2024-01-15,1200.00,Home Depot,materials,Lumber and supplies,Kitchen Reno\n2024-01-18,350.00,Home Depot,materials,Drywall screws,,`,
  revenue: `date,amount,source,category,description,job_name\n2024-01-20,8500.00,John Smith,labour,Rough framing complete,Kitchen Reno\n2024-01-25,3200.00,Jane Doe,materials,Materials deposit,,`,
  time:    `date,employee_name,hours,job_name\n2024-01-15,Mike Torres,8,Kitchen Reno\n2024-01-16,Mike Torres,7.5,Kitchen Reno\n2024-01-15,Dan Park,6,,`,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KindTab({ kind, active, onClick }: { kind: ImportKind; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-2.5 text-sm font-medium transition",
        active
          ? "bg-white/10 text-white"
          : "text-white/50 hover:bg-white/5 hover:text-white/80",
      ].join(" ")}
    >
      {KIND_LABELS[kind]}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportPage() {
  const { loading: gateLoading } = useTenantGate();

  const [kind,        setKind]        = useState<ImportKind>("expense");
  const [step,        setStep]        = useState<Step>("upload");
  const [csvText,     setCsvText]     = useState("");
  const [fileName,    setFileName]    = useState<string | null>(null);
  const [validRows,   setValidRows]   = useState<ValidRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [validating,  setValidating]  = useState(false);
  const [importing,   setImporting]   = useState(false);
  const [result,      setResult]      = useState<{ inserted: number; duplicates: number; errors: number } | null>(null);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [showSample,  setShowSample]  = useState(false);
  const [dismissed,   setDismissed]  = useState(false);

  const dropRef  = useRef<HTMLDivElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  // ── Helpers ──

  function reset() {
    setStep("upload");
    setCsvText("");
    setFileName(null);
    setValidRows([]);
    setInvalidRows([]);
    setApiError(null);
    setResult(null);
    setDismissed(false);
  }

  function switchKind(k: ImportKind) {
    setKind(k);
    reset();
  }

  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  }

  // ── Upload & validate ──

  async function handleFile(file: File) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setApiError("Please upload a .csv or .txt file.");
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    await runValidate(text);
  }

  async function runValidate(text: string) {
    setValidating(true);
    setApiError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/bulk-import/validate", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ kind, csv: text }),
      });
      const data = await res.json();
      if (!data.ok) { setApiError(data.error || "Validation failed."); return; }
      setValidRows(data.valid ?? []);
      setInvalidRows(data.invalid ?? []);
      setStep("preview");
    } catch (e: any) {
      setApiError(e?.message || "Network error.");
    } finally {
      setValidating(false);
    }
  }

  // ── Drag & drop ──

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }, [kind]); // eslint-disable-line

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  // ── Confirm import ──

  async function handleImport() {
    if (!validRows.length) return;
    setImporting(true);
    setApiError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/bulk-import/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ kind, csv: csvText, source_file: fileName }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.code === "OVER_QUOTA") {
          setApiError("Free plan limit: 500 import rows/month. Upgrade to import more.");
        } else {
          setApiError(data.error || "Import failed.");
        }
        return;
      }
      setResult({ inserted: data.inserted, duplicates: data.duplicates, errors: data.errors });
      setStep("done");
    } catch (e: any) {
      setApiError(e?.message || "Network error.");
    } finally {
      setImporting(false);
    }
  }

  // ── Preview table columns ──

  function previewColumns(): string[] {
    if (!validRows.length) return [];
    const preferred = COLUMN_ORDER[kind];
    const keys = Object.keys(validRows[0]);
    return preferred.filter((k) => keys.includes(k));
  }

  function colLabel(k: string): string {
    const map: Record<string, string> = {
      amount_cents:  "Amount",
      vendor:        "Vendor",
      source:        "Source/Client",
      employee_name: "Employee",
      start_at_utc:  "Clock In",
      end_at_utc:    "Clock Out",
      job_name:      "Job",
    };
    return map[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (gateLoading) return <div className="p-8 text-white/70">Loading…</div>;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl py-8 px-4">

        {/* Header */}
        <div className="mb-6">
          <div className={chip("border-white/10 bg-white/5 text-white/60")}>Import</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Bulk Import</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Upload a CSV to bring in historical expenses, revenue, or time records.
            Imported entries appear in your ledgers and company analytics — unassigned entries
            are included in company totals but won&apos;t show up in per-job P&amp;L until you assign them.
          </p>
        </div>

        {/* Kind tabs */}
        <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 w-fit">
          {(["expense", "revenue", "time"] as ImportKind[]).map((k) => (
            <KindTab key={k} kind={k} active={kind === k} onClick={() => switchKind(k)} />
          ))}
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2 text-xs text-white/40">
          {(["upload", "preview", "done"] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-white/20">→</span>}
              <span className={step === s ? "text-white font-medium" : ""}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center transition hover:border-white/30 hover:bg-white/[0.04]"
            >
              <div className="text-4xl text-white/30">↑</div>
              <div className="text-sm font-medium text-white/70">
                Drop a CSV here, or click to browse
              </div>
              <div className="text-xs text-white/35">.csv or .txt · max 5 MB</div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />

            {/* Paste area */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Or paste CSV rows directly
              </label>
              <textarea
                rows={6}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-white/80 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                placeholder={`Paste rows here…\n\nExpected columns: ${COLUMN_ORDER[kind].join(", ")}`}
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setFileName(null); }}
              />
              <button
                type="button"
                onClick={() => runValidate(csvText)}
                disabled={!csvText.trim() || validating}
                className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-40"
              >
                {validating ? "Parsing…" : "Parse & Preview"}
              </button>
            </div>

            {/* Sample CSV toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowSample((v) => !v)}
                className="text-xs text-white/40 underline hover:text-white/60 transition"
              >
                {showSample ? "Hide" : "Show"} sample CSV for {KIND_LABELS[kind].toLowerCase()}
              </button>
              {showSample && (
                <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-mono text-white/60">
                  {SAMPLE_CSV[kind]}
                </pre>
              )}
            </div>

            {/* Kind description */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="text-xs font-medium text-white/50 mb-1">{KIND_LABELS[kind]}</div>
              <div className="text-sm text-white/70">{KIND_DESCRIPTIONS[kind]}</div>
              <div className="mt-2 text-xs text-white/35">
                Required columns: <span className="text-white/50">date, amount{kind === "time" ? " (or clock_in + clock_out)" : ""}</span>
                {kind !== "time" && <span> · Optional: vendor/source, category, description, job_name</span>}
                {kind === "time" && <span> · Required: employee_name · Optional: job_name</span>}
              </div>
            </div>

            {apiError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {apiError}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={chip("border-emerald-500/30 bg-emerald-500/10 text-emerald-300")}>
                {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <span className={chip("border-red-500/30 bg-red-500/10 text-red-300")}>
                  {invalidRows.length} invalid
                </span>
              )}
              {fileName && (
                <span className={chip("border-white/10 bg-white/5 text-white/50")}>
                  {fileName}
                </span>
              )}
              <button
                type="button"
                onClick={reset}
                className="ml-auto text-xs text-white/35 underline hover:text-white/55 transition"
              >
                Start over
              </button>
            </div>

            {apiError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {apiError}
              </div>
            )}

            {/* Valid rows table */}
            {validRows.length > 0 && (
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Valid rows — will be imported
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        {previewColumns().map((col) => (
                          <th key={col} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-white/40">
                            {colLabel(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          {previewColumns().map((col) => (
                            <td key={col} className="whitespace-nowrap px-4 py-2 text-xs text-white/70">
                              {formatRowValue(col, row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validRows.length > 50 && (
                  <div className="border-t border-white/8 px-4 py-2 text-xs text-white/35">
                    + {validRows.length - 50} more rows (all will be imported)
                  </div>
                )}
              </div>
            )}

            {/* Invalid rows */}
            {invalidRows.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 overflow-hidden">
                <div className="border-b border-red-500/15 bg-red-500/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-red-300/70">
                  Invalid rows — will be skipped
                </div>
                <div className="divide-y divide-white/5">
                  {invalidRows.slice(0, 20).map((item, i) => (
                    <div key={i} className="px-4 py-2.5">
                      <div className="text-xs text-red-300">{item.errors.join(" · ")}</div>
                      <div className="mt-0.5 truncate text-[11px] text-white/30">
                        {JSON.stringify(item.row).slice(0, 120)}
                      </div>
                    </div>
                  ))}
                  {invalidRows.length > 20 && (
                    <div className="px-4 py-2 text-xs text-white/30">
                      + {invalidRows.length - 20} more invalid rows
                    </div>
                  )}
                </div>
              </div>
            )}

            {validRows.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/50">
                No valid rows found. Check your CSV format and try again.
              </div>
            )}

            {/* Import button */}
            {validRows.length > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {importing ? "Importing…" : `Import ${validRows.length} row${validRows.length !== 1 ? "s" : ""}`}
                </button>
                <span className="text-xs text-white/35">
                  {invalidRows.length > 0 ? `${invalidRows.length} invalid row${invalidRows.length !== 1 ? "s" : ""} will be skipped` : "All rows are valid"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-8 text-center">
              <div className="text-3xl font-bold text-emerald-400">{result.inserted}</div>
              <div className="mt-1 text-sm font-medium text-emerald-300">
                {KIND_LABELS[kind].toLowerCase()} imported
              </div>
              {result.duplicates > 0 && (
                <div className="mt-2 text-xs text-white/40">
                  {result.duplicates} duplicate{result.duplicates !== 1 ? "s" : ""} skipped
                </div>
              )}
              {result.errors > 0 && (
                <div className="mt-1 text-xs text-red-400">
                  {result.errors} row{result.errors !== 1 ? "s" : ""} failed — check logs
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/60">
              Imported {KIND_LABELS[kind].toLowerCase()} are now visible in your ledger and included in
              company-wide analytics (margins, comparisons, vendor rankings). Entries without a job
              assigned won&apos;t appear in per-job P&amp;L — assign them from the ledger if needed.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { reset(); }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Import more
              </button>
              <a
                href={kind === "time" ? "/app/activity/time" : `/app/activity/${kind === "expense" ? "expenses" : "revenue"}`}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                View in ledger →
              </a>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
