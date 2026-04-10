"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

// ─── Types ────────────────────────────────────────────────────────────────────

type LineItem = {
  description: string;
  sku: string | null;
  quantity: number | null;
  unitPrice: string | null;
  amount: string;
};

type IntakeItem = {
  id: string; batch_id: string; kind: string; status: string;
  source_filename: string | null; draft_type: string | null;
  confidence_score: number | null; created_at: string;
  draft_amount_cents?: number | null; draft_currency?: string | null;
  draft_vendor?: string | null; draft_description?: string | null;
  draft_event_date?: string | null; draft_job_name?: string | null;
  draft_validation_flags?: string[]; fast_confirm_ready?: boolean;
  draft_subtotal_cents?: number | null;
  draft_tax_cents?: number | null;
  draft_tax_label?: string | null;
  draft_line_items?: LineItem[] | null;
};

type OverheadReminder = {
  id: string; item_name: string; period_year: number; period_month: number;
  amount_cents: number; tax_amount_cents: number | null; created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return "—";
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: String(currency || "USD").toUpperCase() });
  } catch { return `$${(cents / 100).toFixed(2)}`; }
}

function fmtDate(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

const ACCEPTED = "image/*,application/pdf,audio/*,.pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.mp3,.m4a,.wav,.aac,.ogg,.webm";

type UploadState = "idle" | "uploading" | "done" | "error";

function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [files, setFiles]       = useState<File[]>([]);
  const [state, setState]       = useState<UploadState>("idle");
  const [message, setMessage]   = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming || !incoming.length) return;
    const next = Array.from(incoming);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...next.filter((f) => !existing.has(f.name + f.size))];
    });
    setState("idle");
    setMessage(null);
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  async function upload() {
    if (!files.length) return;
    setState("uploading");
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (!token) throw new Error("Not signed in.");

      const form = new FormData();
      for (const f of files) form.append("files", f);

      const r = await fetch("/api/intake/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Upload failed.");

      const { uploadedCount = 0, duplicateCount = 0 } = j;
      const dupeNote = duplicateCount > 0 ? ` (${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""} flagged)` : "";
      setMessage(`${uploadedCount} file${uploadedCount !== 1 ? "s" : ""} uploaded${dupeNote}. Processing will start shortly.`);
      setState("done");
      setFiles([]);
      onUploaded();
    } catch (e: any) {
      setState("error");
      setMessage(e?.message || "Upload failed.");
    }
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <section className="rounded-[24px] border border-white/10 bg-black/40 p-5 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Upload receipts &amp; documents</div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition
          ${dragOver ? "border-white/40 bg-white/5" : "border-white/15 bg-black/20 hover:border-white/25 hover:bg-white/[0.02]"}`}
      >
        <svg className="h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4.75 17.25v.5A2.25 2.25 0 0 0 7 20h10a2.25 2.25 0 0 0 2.25-2.25v-.5" />
        </svg>
        <div className="text-sm text-white/50">
          <span className="font-medium text-white/70">Click to select</span> or drag files here
        </div>
        <div className="text-xs text-white/35">Images, PDFs, audio — multiple files OK</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
        />
      </div>

      {/* Selected file list */}
      {files.length > 0 && (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/30 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm text-white/80">{f.name}</div>
                <div className="text-xs text-white/35">{(f.size / 1024).toFixed(0)} KB</div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 text-xs text-white/35 hover:text-red-300 transition"
                aria-label="Remove"
              >✕</button>
            </li>
          ))}
        </ul>
      )}

      {/* Status message */}
      {message && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${state === "error" ? "border-red-500/20 bg-red-500/10 text-red-200" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"}`}>
          {message}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && state !== "done" && (
        <button
          type="button"
          onClick={upload}
          disabled={state === "uploading"}
          className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "uploading"
            ? `Uploading ${files.length} file${files.length !== 1 ? "s" : ""}…`
            : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
        </button>
      )}
    </section>
  );
}

// ─── Inbox content ────────────────────────────────────────────────────────────

function ReviewContent({ tenantId, refreshKey }: { tenantId: string; refreshKey: number }) {
  const [loading, setLoading]     = useState(true);
  const [rows, setRows]           = useState<IntakeItem[]>([]);
  const [reminders, setReminders] = useState<OverheadReminder[]>([]);
  const [busyId, setBusyId]       = useState<string | null>(null);
  const [busyRem, setBusyRem]     = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || "";
    if (!token) throw new Error("Missing session");
    return { Authorization: `Bearer ${token}` };
  }

  async function load() {
    setLoading(true); setErr(null);
    try {
      const headers = await authHeader();
      const url = new URL("/api/intake/items", window.location.origin);
      url.searchParams.set("status", "all");
      const [intakeRes, { data: remData }] = await Promise.all([
        fetch(url.toString(), { headers, cache: "no-store" }),
        (async () => {
          const now = new Date();
          return supabase.from("overhead_reminders")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("status", "pending")
            .eq("period_year", now.getFullYear())
            .eq("period_month", now.getMonth() + 1)
            .order("created_at");
        })(),
      ]);
      const j = await intakeRes.json().catch(() => ({}));
      if (!intakeRes.ok || !j?.ok) throw new Error(j?.error || "Failed to load inbox.");
      const finalStatuses = new Set(["persisted", "confirmed", "deleted", "duplicate", "skipped"]);
      setRows((Array.isArray(j.rows) ? j.rows : []).filter((r: IntakeItem) => !finalStatuses.has(r.status)));
      setReminders((remData || []) as OverheadReminder[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load inbox.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmReminder(id: string, action: "confirm" | "skip") {
    setBusyRem(id);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const r = await fetch("/api/overhead/confirm-reminder", { method: "POST", headers, body: JSON.stringify({ reminder_id: id, action }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setReminders((prev) => prev.filter((rem) => rem.id !== id));
    } catch (e: any) { setErr(e?.message || "Failed."); }
    finally { setBusyRem(null); }
  }

  async function processBatch(batchId: string) {
    setBusyId(batchId);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const r = await fetch("/api/intake/process", { method: "POST", headers, body: JSON.stringify({ batchId }) });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed.");
      await load();
    } catch (e: any) { setErr(e?.message); }
    finally { setBusyId(null); }
  }

  async function deleteItem(itemId: string) {
    setBusyId(itemId);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/delete`, { method: "POST", headers, body: JSON.stringify({ comment: "Deleted from inbox." }) });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Delete failed.");
      await load();
    } catch (e: any) { setErr(e?.message); }
    finally { setBusyId(null); }
  }

  useEffect(() => { void load(); }, [tenantId, refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, IntakeItem[]>();
    for (const row of rows) {
      const list = map.get(row.batch_id) || [];
      list.push(row);
      map.set(row.batch_id, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (loading) return <div className="py-8 text-sm text-white/50">Loading inbox…</div>;

  return (
    <div className="space-y-5">
      {err && <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

      {/* Overhead payment confirmations */}
      {reminders.length > 0 && (
        <section className="rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-amber-400/70">Overhead payments — confirm or skip</div>
          <div className="space-y-2">
            {reminders.map((rem) => {
              const total = rem.amount_cents + (rem.tax_amount_cents || 0);
              const monthName = new Date(rem.period_year, rem.period_month - 1).toLocaleString(undefined, { month: "long", year: "numeric" });
              const busy = busyRem === rem.id;
              return (
                <div key={rem.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-white/85">{rem.item_name}</div>
                    <div className="text-xs text-white/45">{monthName} · ${(total / 100).toFixed(2)}{rem.tax_amount_cents ? " incl. tax" : ""}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" disabled={busy} onClick={() => confirmReminder(rem.id, "confirm")} className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-40">{busy ? "…" : "Yes, paid ✓"}</button>
                    <button type="button" disabled={busy} onClick={() => confirmReminder(rem.id, "skip")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10 transition disabled:opacity-40">Skip</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Intake items */}
      {grouped.length === 0 && reminders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm text-white/50">
          Nothing pending — you're all caught up.
        </div>
      ) : grouped.map(([batchId, items]) => {
        const best = items.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))[0];
        return (
          <section key={batchId} className="rounded-[24px] border border-white/10 bg-black/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-[11px] text-white/40">Batch</div>
                <div className="mt-0.5 text-sm font-semibold text-white/85 truncate max-w-xs">{batchId}</div>
                <div className="text-xs text-white/45">{items.length} item(s)</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => processBatch(batchId)} disabled={busyId === batchId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-50">{busyId === batchId ? "Processing…" : "Re-process"}</button>
                {best && <a href={`/app/pending-review/${best.id}`} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90 transition">{best.fast_confirm_ready ? "One-tap confirm" : "Open & review"}</a>}
              </div>
            </div>
            <div className="divide-y divide-white/10">
              {items.map((item) => {
                const flags = Array.isArray(item.draft_validation_flags) ? item.draft_validation_flags.filter(Boolean) : [];
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <a href={`/app/pending-review/${item.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">{item.kind}</span>
                        {item.draft_type && <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/50">{item.draft_type}</span>}
                        {item.fast_confirm_ready && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">Ready</span>}
                        {flags.length > 0 && !item.fast_confirm_ready && <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">{flags.length} flag{flags.length > 1 ? "s" : ""}</span>}
                      </div>
                      <div className="mt-1.5 truncate text-sm font-medium text-white/85">{item.source_filename || item.id}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/45">
                        {item.draft_vendor && <span>Vendor: {item.draft_vendor}</span>}
                        {item.draft_amount_cents != null && <span>Amount: {money(item.draft_amount_cents, item.draft_currency)}</span>}
                        {item.draft_event_date && <span>Date: {item.draft_event_date}</span>}
                        <span>{fmtDate(item.created_at)}</span>
                      </div>
                    </a>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-white/50">
                      <div>{item.confidence_score != null ? `${Math.round(item.confidence_score * 100)}%` : "—"}</div>
                      <button type="button" onClick={() => deleteItem(item.id)} disabled={busyId === item.id} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/15 transition disabled:opacity-50">{busyId === item.id ? "…" : "Delete"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex justify-end">
        <button type="button" onClick={load} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 hover:bg-white/10 transition">Refresh</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function InboxPageInner() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const [refreshKey, setRefreshKey] = useState(0);

  if (gate.loading) return <div className="p-8 text-sm text-white/60">Loading…</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-5 space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Business</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">Inbox</h1>
          <p className="mt-1.5 text-sm text-white/50">Upload receipts and documents, or review items sent via WhatsApp.</p>
        </div>
        <UploadPanel onUploaded={() => setRefreshKey((k) => k + 1)} />
        {gate.tenantId && <ReviewContent tenantId={gate.tenantId} refreshKey={refreshKey} />}
      </div>
    </main>
  );
}

export default function LogReviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-white/60">Loading…</div>}>
      <InboxPageInner />
    </Suspense>
  );
}
