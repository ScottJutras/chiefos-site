"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "log" | "review";

type CardType = "receipt" | "expense" | "revenue" | "hours" | "task" | "reminder";

type Job = { id: number; job_name: string | null; name: string | null; job_no: number | null };

type IntakeItem = {
  id: string; batch_id: string; kind: string; status: string;
  source_filename: string | null; draft_type: string | null;
  confidence_score: number | null; created_at: string;
  draft_amount_cents?: number | null; draft_currency?: string | null;
  draft_vendor?: string | null; draft_description?: string | null;
  draft_event_date?: string | null; draft_job_name?: string | null;
  draft_validation_flags?: string[]; fast_confirm_ready?: boolean;
};

type OverheadReminder = {
  id: string; item_name: string; period_year: number; period_month: number;
  amount_cents: number; tax_amount_cents: number | null; created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

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

// ─── Card definitions ─────────────────────────────────────────────────────────

const CARDS: { type: CardType; label: string; icon: string; color: string }[] = [
  { type: "receipt",  label: "Receipt / File", icon: "📷", color: "border-white/15 hover:border-white/30" },
  { type: "expense",  label: "Expense",        icon: "💸", color: "border-white/15 hover:border-white/30" },
  { type: "revenue",  label: "Revenue",        icon: "💰", color: "border-white/15 hover:border-white/30" },
  { type: "hours",    label: "Labour Hours",   icon: "⏱",  color: "border-white/15 hover:border-white/30" },
  { type: "task",     label: "Task",           icon: "✅", color: "border-white/15 hover:border-white/30" },
  { type: "reminder", label: "Reminder",       icon: "🔔", color: "border-white/15 hover:border-white/30" },
];

// ─── Shared form input style ──────────────────────────────────────────────────

const inp = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/30";
const lbl = "mb-1 block text-[11px] text-white/50";

// ─── Job selector ─────────────────────────────────────────────────────────────

function JobSelect({ value, onChange, jobs }: { value: string; onChange: (v: string, id?: number, no?: number | null) => void; jobs: Job[] }) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const j = jobs.find((j) => String(j.id) === e.target.value);
        onChange(j ? (j.job_name || j.name || "") : "", j?.id, j?.job_no);
      }}
      className={inp}
    >
      <option value="">— No job —</option>
      {jobs.map((j) => (
        <option key={j.id} value={String(j.id)}>
          {j.job_name || j.name || `Job #${j.job_no}`}
        </option>
      ))}
    </select>
  );
}

// ─── Log forms ────────────────────────────────────────────────────────────────

type ReceiptItemForm = {
  vendor: string; amount: string; date: string;
  description: string; job_name: string; job_id: number; draft_type: string;
};

// ─── Zoomable image ───────────────────────────────────────────────────────────

function ZoomableImage({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const lastPinch = useRef<number | null>(null);

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const maxX = (el.clientWidth * (s - 1)) / 2;
    const maxY = (el.clientHeight * (s - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  const doZoom = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.max(1, Math.min(5, prev + delta));
      if (next === prev) return prev;
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Mouse wheel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      doZoom(e.deltaY < 0 ? 0.3 : -0.3);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [doZoom]);

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.startX);
    const ny = drag.current.oy + (e.clientY - drag.current.startY);
    setOffset(clampOffset(nx, ny, scale));
  };
  const onMouseUp = () => { drag.current = null; };

  // Touch pinch + drag
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinch.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && scale > 1) {
      drag.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinch.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      doZoom((dist - lastPinch.current) * 0.02);
      lastPinch.current = dist;
    } else if (e.touches.length === 1 && drag.current) {
      const nx = drag.current.ox + (e.touches[0].clientX - drag.current.startX);
      const ny = drag.current.oy + (e.touches[0].clientY - drag.current.startY);
      setOffset(clampOffset(nx, ny, scale));
    }
  };
  const onTouchEnd = () => { drag.current = null; lastPinch.current = null; };

  // Double-click / double-tap to reset
  const onDoubleClick = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30"
      style={{ height: "288px", cursor: scale > 1 ? "grab" : "zoom-in", touchAction: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={onDoubleClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Receipt preview"
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transformOrigin: "center center",
          transition: drag.current ? "none" : "transform 0.1s ease",
          userSelect: "none",
        }}
      />
      {scale > 1 && (
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/60 pointer-events-none">
          {Math.round(scale * 100)}% · double-tap to reset
        </div>
      )}
      {scale === 1 && (
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/60 pointer-events-none">
          scroll or pinch to zoom
        </div>
      )}
    </div>
  );
}

function ReceiptForm({ jobs, onDone, onSaveLater }: { jobs: Job[]; onDone: () => void; onSaveLater: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "fetching" | "review" | "confirming" | "confirmed" | "error">("idle");
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [forceIds, setForceIds] = useState<Set<string>>(new Set());
  const [forms, setForms] = useState<Record<string, ReceiptItemForm>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const busy = ["uploading", "processing", "fetching", "confirming"].includes(phase);

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function upload() {
    try {
      setPhase("uploading"); setErr(null);
      const token = await authToken();
      if (!token || !files.length) throw new Error("No files selected.");

      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const upRes = await fetch("/api/intake/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upJson?.ok) throw new Error(upJson?.error || "Upload failed.");

      setPhase("processing");
      const prRes = await fetch("/api/intake/process", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ batchId: upJson.batchId }) });
      const prJson = await prRes.json().catch(() => ({}));
      if (!prRes.ok || !prJson?.ok) throw new Error(prJson?.error || "Processing failed.");

      setPhase("fetching");
      const iRes = await fetch(`/api/intake/items?batchId=${encodeURIComponent(upJson.batchId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const iJson = await iRes.json().catch(() => ({}));
      const fetchedItems: IntakeItem[] = Array.isArray(iJson.rows) ? iJson.rows : [];

      const initialForms: Record<string, ReceiptItemForm> = {};
      for (const item of fetchedItems) {
        initialForms[item.id] = {
          vendor: item.draft_vendor || "",
          amount: item.draft_amount_cents != null ? (item.draft_amount_cents / 100).toFixed(2) : "",
          date: item.draft_event_date || today(),
          description: item.draft_description || "",
          job_name: item.draft_job_name || "",
          job_id: 0,
          draft_type: item.draft_type || "expense",
        };
      }
      // Capture local image previews before clearing file list
      const newPreviews: Record<string, string> = {};
      files.forEach((f) => { if (f.type.startsWith("image/")) newPreviews[f.name] = URL.createObjectURL(f); });
      setPreviews(newPreviews);
      setItems(fetchedItems);
      setForms(initialForms);
      setConfirmedIds(new Set());
      setForceIds(new Set());
      setFiles([]);
      setPhase("review");
    } catch (e: any) {
      setErr(e?.message || "Upload failed.");
      setPhase("error");
    }
  }

  function updateForm(itemId: string, key: keyof ReceiptItemForm, value: string | number) {
    setForms((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [key]: value } }));
  }

  async function confirmItem(item: IntakeItem, force = false) {
    const f = forms[item.id];
    if (!f) return;
    const amountCents = Math.round(parseFloat(f.amount || "0") * 100);
    if (!amountCents || amountCents <= 0) { setErr("Enter a valid amount."); return; }
    setPhase("confirming"); setErr(null);
    try {
      const token = await authToken();
      const r = await fetch(`/api/intake/items/${item.id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          draftType: f.draft_type || "expense",
          amountCents,
          vendor: f.vendor || null,
          eventDate: f.date || null,
          description: f.description || null,
          jobName: f.job_name || null,
          jobId: f.job_id || null,
          force,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        if (j.code === "BLOCKING_FLAGS") setForceIds((prev) => new Set([...prev, item.id]));
        throw new Error(j.error || "Confirm failed.");
      }
      const newConfirmed = new Set([...confirmedIds, item.id]);
      setConfirmedIds(newConfirmed);
      const allDone = items.every((i) => newConfirmed.has(i.id));
      setPhase(allDone ? "confirmed" : "review");
    } catch (e: any) {
      setErr(e?.message || "Confirm failed.");
      setPhase("review");
    }
  }

  function reset() {
    // Revoke any object URLs to avoid memory leaks
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    setPhase("idle"); setItems([]); setForms({});
    setConfirmedIds(new Set()); setForceIds(new Set()); setPreviews({});
  }

  if (phase === "confirmed") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        <div className="font-semibold text-emerald-300">All receipts logged ✓</div>
        <div className="mt-3">
          <button type="button" onClick={reset} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Upload more</button>
        </div>
      </div>
    );
  }

  if (phase === "review" || (phase === "confirming" && items.length > 0)) {
    return (
      <div className="space-y-4">
        {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
        {items.map((item) => {
          const f = forms[item.id] || {} as ReceiptItemForm;
          const isConfirmed = confirmedIds.has(item.id);
          const canForce = forceIds.has(item.id);
          const flags = Array.isArray(item.draft_validation_flags) ? item.draft_validation_flags.filter(Boolean) : [];
          const previewUrl = previews[item.source_filename || ""] || null;
          const noDataExtracted = !f.vendor && !f.amount && !f.date;
          return (
            <div key={item.id} className={["rounded-2xl border p-4 space-y-3 transition", isConfirmed ? "border-emerald-500/20 bg-emerald-500/5 opacity-60" : "border-white/10 bg-black/30"].join(" ")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-white/50 truncate">{item.source_filename || "Receipt"}</div>
                  {flags.length > 0 && <div className="mt-0.5 text-[10px] text-amber-300">{flags.join(" · ")}</div>}
                </div>
                {isConfirmed && <span className="shrink-0 text-xs font-semibold text-emerald-400">Logged ✓</span>}
              </div>

              {/* Image preview */}
              {!isConfirmed && previewUrl && (
                <ZoomableImage src={previewUrl} />
              )}

              {/* OCR notice when nothing was extracted */}
              {!isConfirmed && noDataExtracted && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                  Chief couldn't extract data automatically — fill in the details below.
                </div>
              )}

              {!isConfirmed && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className={lbl}>Vendor / Payee</label><input className={inp} value={f.vendor} onChange={(e) => updateForm(item.id, "vendor", e.target.value)} placeholder="e.g. Home Depot" /></div>
                    <div><label className={lbl}>Amount ($) *</label><input type="number" min="0.01" step="0.01" className={inp} value={f.amount} onChange={(e) => updateForm(item.id, "amount", e.target.value)} placeholder="0.00" /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className={lbl}>Date</label><input type="date" className={inp} value={f.date || today()} onChange={(e) => updateForm(item.id, "date", e.target.value)} /></div>
                    <div><label className={lbl}>Type</label>
                      <select className={inp} value={f.draft_type || "expense"} onChange={(e) => updateForm(item.id, "draft_type", e.target.value)}>
                        <option value="expense">Expense</option>
                        <option value="revenue">Revenue</option>
                      </select>
                    </div>
                  </div>
                  <div><label className={lbl}>Job (optional)</label>
                    <JobSelect value={f.job_id ? String(f.job_id) : ""} jobs={jobs} onChange={(name, id) => { updateForm(item.id, "job_name", name); updateForm(item.id, "job_id", id ?? 0); }} />
                  </div>
                  <div><label className={lbl}>Notes (optional)</label><input className={inp} value={f.description} onChange={(e) => updateForm(item.id, "description", e.target.value)} placeholder="Description or notes" /></div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canForce ? (
                      <button type="button" onClick={() => confirmItem(item, true)} disabled={busy}
                        className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-40 transition">
                        {phase === "confirming" ? "Logging…" : "Confirm anyway"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => confirmItem(item)} disabled={busy}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">
                        {phase === "confirming" ? "Logging…" : "Confirm & Log"}
                      </button>
                    )}
                    <button type="button" onClick={onSaveLater} disabled={busy}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-40 transition">
                      Save for Later
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
        <input type="file" multiple accept="image/*,audio/*,.pdf" disabled={busy}
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="block w-full text-sm text-white/80 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black hover:file:bg-white/90 disabled:opacity-50"
        />
        <div className="mt-2 text-xs text-white/35">Images, audio, PDFs — Chief extracts the data for you to confirm.</div>
      </div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      {phase === "processing" && <div className="text-xs text-white/50">Extracting data from your receipt…</div>}
      {phase === "fetching" && <div className="text-xs text-white/50">Loading extracted data…</div>}
      <button type="button" onClick={upload} disabled={busy || !files.length}
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">
        {phase === "uploading" ? "Uploading…" : phase === "processing" ? "Processing…" : phase === "fetching" ? "Loading…" : `Upload ${files.length ? `${files.length} file(s)` : ""}`}
      </button>
    </div>
  );
}

function ExpenseForm({ jobs, onDone }: { jobs: Job[]; onDone: () => void }) {
  const [f, setF] = useState({ payee: "", amount: "", date: today(), category: "", description: "", job_name: "", job_id: 0, job_no: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "expense", ...f }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Expense logged ✓</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setDone(false); setF({ payee: "", amount: "", date: today(), category: "", description: "", job_name: "", job_id: 0, job_no: 0 }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Log another</button>
        <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View in Review →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Payee / Vendor</label><input className={inp} placeholder="e.g. Home Depot" value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} /></div>
        <div><label className={lbl}>Amount ($) *</label><input type="number" min="0.01" step="0.01" className={inp} placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Date</label><input type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className={lbl}>Category</label>
          <select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">— Select —</option>
            <option value="materials">Materials</option>
            <option value="subcontract">Subcontract</option>
            <option value="fuel">Fuel</option>
            <option value="tools">Tools / Equipment</option>
            <option value="permits">Permits / Fees</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div><label className={lbl}>Job (optional)</label><JobSelect value={f.job_id ? String(f.job_id) : ""} jobs={jobs} onChange={(name, id, no) => setF({ ...f, job_name: name, job_id: id ?? 0, job_no: no ?? 0 })} /></div>
      <div><label className={lbl}>Notes (optional)</label><input className={inp} placeholder="Description or notes" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.amount} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Log expense"}</button>
    </div>
  );
}

function RevenueForm({ jobs, onDone }: { jobs: Job[]; onDone: () => void }) {
  const [f, setF] = useState({ amount: "", date: today(), description: "", job_name: "", job_id: 0, job_no: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "revenue", ...f }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Revenue logged ✓</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setDone(false); setF({ amount: "", date: today(), description: "", job_name: "", job_id: 0, job_no: 0 }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Log another</button>
        <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View in My Books →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Amount ($) *</label><input type="number" min="0.01" step="0.01" className={inp} placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
        <div><label className={lbl}>Date</label><input type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      </div>
      <div><label className={lbl}>Job (optional)</label><JobSelect value={f.job_id ? String(f.job_id) : ""} jobs={jobs} onChange={(name, id, no) => setF({ ...f, job_name: name, job_id: id ?? 0, job_no: no ?? 0 })} /></div>
      <div><label className={lbl}>Description (optional)</label><input className={inp} placeholder="e.g. Deposit received" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.amount} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Log revenue"}</button>
    </div>
  );
}

function HoursForm({ jobs, onDone }: { jobs: Job[]; onDone: () => void }) {
  const [f, setF] = useState({ employee_name: "", hours: "", date: today(), job_name: "", job_id: 0, job_no: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "hours", ...f }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Hours logged ✓</div>
      <div className="mt-3">
        <button type="button" onClick={() => { setDone(false); setF({ employee_name: "", hours: "", date: today(), job_name: "", job_id: 0, job_no: 0 }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Log more</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Employee name</label><input className={inp} placeholder="Leave blank for yourself" value={f.employee_name} onChange={(e) => setF({ ...f, employee_name: e.target.value })} /></div>
        <div><label className={lbl}>Hours worked *</label><input type="number" min="0.25" step="0.25" className={inp} placeholder="e.g. 7.5" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Date</label><input type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className={lbl}>Job (optional)</label><JobSelect value={f.job_id ? String(f.job_id) : ""} jobs={jobs} onChange={(name, id, no) => setF({ ...f, job_name: name, job_id: id ?? 0, job_no: no ?? 0 })} /></div>
      </div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.hours} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Log hours"}</button>
    </div>
  );
}

function TaskForm({ jobs, onDone }: { jobs: Job[]; onDone: () => void }) {
  const [f, setF] = useState({ title: "", notes: "", due_at: "", job_name: "", job_id: 0, job_no: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "task", ...f }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Task created ✓</div>
      <div className="mt-3">
        <button type="button" onClick={() => { setDone(false); setF({ title: "", notes: "", due_at: "", job_name: "", job_id: 0, job_no: 0 }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Add another</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div><label className={lbl}>Title *</label><input className={inp} placeholder="What needs to be done?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Job (optional)</label><JobSelect value={f.job_id ? String(f.job_id) : ""} jobs={jobs} onChange={(name, id, no) => setF({ ...f, job_name: name, job_id: id ?? 0, job_no: no ?? 0 })} /></div>
        <div><label className={lbl}>Due date (optional)</label><input type="datetime-local" className={inp} value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></div>
      </div>
      <div><label className={lbl}>Notes (optional)</label><input className={inp} placeholder="Additional details" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.title} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Create task"}</button>
    </div>
  );
}

function ReminderForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ title: "", remind_at: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "reminder", ...f }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Reminder set ✓</div>
      <div className="mt-3">
        <button type="button" onClick={() => { setDone(false); setF({ title: "", remind_at: "" }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Set another</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div><label className={lbl}>What to remind you about *</label><input className={inp} placeholder="e.g. Follow up with client" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><label className={lbl}>When *</label><input type="datetime-local" className={inp} value={f.remind_at} onChange={(e) => setF({ ...f, remind_at: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.title || !f.remind_at} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Set reminder"}</button>
    </div>
  );
}

// ─── Review tab content ───────────────────────────────────────────────────────

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
      // Show all non-final statuses so items appear immediately after upload+process
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
      if (!intakeRes.ok || !j?.ok) throw new Error(j?.error || "Failed to load review queue.");
      const finalStatuses = new Set(["persisted", "confirmed", "deleted", "duplicate", "skipped"]);
      setRows((Array.isArray(j.rows) ? j.rows : []).filter((r: IntakeItem) => !finalStatuses.has(r.status)));
      setReminders((remData || []) as OverheadReminder[]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load review queue.");
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
      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/delete`, { method: "POST", headers, body: JSON.stringify({ comment: "Deleted from review queue." }) });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Delete failed.");
      await load();
    } catch (e: any) { setErr(e?.message); }
    finally { setBusyId(null); }
  }

  useEffect(() => { void load(); }, [tenantId, refreshKey]);

  // Group by batch
  const grouped = useMemo(() => {
    const map = new Map<string, IntakeItem[]>();
    for (const row of rows) {
      const list = map.get(row.batch_id) || [];
      list.push(row);
      map.set(row.batch_id, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (loading) return <div className="py-8 text-sm text-white/50">Loading review queue…</div>;

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
          Nothing pending review — you're all caught up.
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

function LogReviewPageInner() {
  const gate         = useTenantGate({ requireWhatsApp: false });
  const searchParams = useSearchParams();
  const router       = useRouter();

  const initialTab   = (searchParams.get("tab") === "review" ? "review" : "log") as Tab;
  const [tab, setTab]           = useState<Tab>(initialTab);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewKey, setReviewKey] = useState(0);

  function switchTab(t: Tab) {
    setTab(t);
    if (t === "review") setReviewKey((k) => k + 1);
    router.replace(`/app/uploads?tab=${t}`, { scroll: false });
  }

  // Load jobs for dropdowns
  useEffect(() => {
    if (!gate.tenantId) return;
    supabase.from("jobs").select("id, job_name, name, job_no").eq("tenant_id", gate.tenantId).eq("active", true).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setJobs((data as Job[]) || []));
  }, [gate.tenantId]);

  // Load pending count for review badge
  useEffect(() => {
    if (!gate.tenantId) return;
    supabase.from("intake_items").select("*", { count: "exact", head: true }).eq("tenant_id", gate.tenantId).in("status", ["pending_review", "uploaded", "validated", "extracted"])
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [gate.tenantId, tab]);

  function selectCard(type: CardType) {
    setActiveCard(activeCard === type ? null : type);
  }

  function onLogDone() {
    switchTab("review");
    setActiveCard(null);
  }

  // For "Save for Later" on receipt — switch to review but keep the receipt card open
  function onSaveLater() {
    switchTab("review");
  }

  if (gate.loading) return <div className="p-8 text-sm text-white/60">Loading…</div>;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-5 space-y-6">

        {/* Header */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Business</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">Log & Review</h1>
          <p className="mt-1.5 text-sm text-white/50">Log new entries or review items waiting for confirmation.</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 gap-1">
          {(["log", "review"] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => switchTab(t)}
              className={["rounded-lg px-5 py-2 text-sm font-medium transition relative",
                tab === t ? "bg-white text-black" : "text-white/55 hover:text-white/85",
              ].join(" ")}>
              {t === "log" ? "Log" : "Review"}
              {t === "review" && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Log tab — always rendered, hidden via CSS when not active so form state persists */}
        <div className={tab === "log" ? "space-y-5" : "hidden"}>
          {/* Action cards */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {CARDS.map((card) => (
              <button key={card.type} type="button" onClick={() => selectCard(card.type)}
                className={["rounded-2xl border p-4 flex flex-col items-center gap-2 transition text-center",
                  activeCard === card.type
                    ? "border-white/40 bg-white/10 text-white"
                    : `${card.color} bg-white/[0.03] text-white/65 hover:text-white hover:bg-white/[0.06]`,
                ].join(" ")}>
                <span className="text-2xl">{card.icon}</span>
                <span className="text-[11px] font-medium leading-tight">{card.label}</span>
              </button>
            ))}
          </div>

          {/* Active form */}
          {activeCard && (
            <div className="rounded-[24px] border border-white/10 bg-black/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/85">
                  {CARDS.find((c) => c.type === activeCard)?.icon}{" "}
                  {CARDS.find((c) => c.type === activeCard)?.label}
                </div>
                <button type="button" onClick={() => setActiveCard(null)} className="text-white/30 hover:text-white/60 transition text-sm px-1">✕</button>
              </div>
              {activeCard === "receipt"  && <ReceiptForm  jobs={jobs} onDone={onLogDone} onSaveLater={onSaveLater} />}
              {activeCard === "expense"  && <ExpenseForm  jobs={jobs} onDone={onLogDone} />}
              {activeCard === "revenue"  && <RevenueForm  jobs={jobs} onDone={onLogDone} />}
              {activeCard === "hours"    && <HoursForm    jobs={jobs} onDone={onLogDone} />}
              {activeCard === "task"     && <TaskForm     jobs={jobs} onDone={onLogDone} />}
              {activeCard === "reminder" && <ReminderForm             onDone={onLogDone} />}
            </div>
          )}

          {!activeCard && (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/35">
              Select what you want to log above.
            </div>
          )}
        </div>

        {/* Review tab — always rendered, hidden via CSS when not active so it doesn't reload on switch */}
        <div className={tab === "review" ? "" : "hidden"}>
          {gate.tenantId && <ReviewContent tenantId={gate.tenantId} refreshKey={reviewKey} />}
        </div>
      </div>
    </main>
  );
}

export default function LogReviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-white/60">Loading…</div>}>
      <LogReviewPageInner />
    </Suspense>
  );
}
