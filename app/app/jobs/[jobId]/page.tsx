"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobRow = {
  id: number;
  job_no: number | null;
  job_name: string | null;
  name: string | null;
  status: string | null;
  active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  material_budget_cents: number | null;
  labour_hours_budget: number | null;
  contract_value_cents: number | null;
};

type TimeEntry = {
  job_no: number | null;
  type: string | null;
  timestamp: string | null;
};

type JobDocument = {
  id: string;
  stage: string;
  lead_notes: string | null;
  lead_source: string | null;
  customer_id: string | null;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type QuoteLineItem = {
  id: string;
  description: string;
  qty: number;
  unit_price_cents: number;
  category: string | null;
  sort_order: number;
};

type Tab = "overview" | "documents" | "activity" | "photos";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(cents: number) {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  if (abs >= 100_000_00) return `${sign}$${Math.round(abs / 100_00) / 10}M`;
  if (abs >= 10_000_00) return `${sign}$${Math.round(abs / 100_0) / 10}k`;
  return `${sign}$${(abs / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtHours(h: number) {
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
}

function calcWorkHours(entries: TimeEntry[]): number {
  const sorted = [...entries]
    .filter((e) => e.timestamp && e.type)
    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

  let totalMs = 0;
  let clockInAt: number | null = null;
  let breakStartAt: number | null = null;
  let lunchStartAt: number | null = null;
  let breakDeductMs = 0;
  let lunchDeductMs = 0;

  for (const e of sorted) {
    const ts = new Date(e.timestamp!).getTime();
    switch (e.type) {
      case "clock_in":
        clockInAt = ts;
        breakDeductMs = 0;
        lunchDeductMs = 0;
        breakStartAt = null;
        lunchStartAt = null;
        break;
      case "break_start":
        breakStartAt = ts;
        break;
      case "break_stop":
        if (breakStartAt !== null) { breakDeductMs += ts - breakStartAt; breakStartAt = null; }
        break;
      case "lunch_start":
        lunchStartAt = ts;
        break;
      case "lunch_end":
        if (lunchStartAt !== null) { lunchDeductMs += ts - lunchStartAt; lunchStartAt = null; }
        break;
      case "clock_out":
        if (clockInAt !== null) {
          totalMs += Math.max(0, ts - clockInAt - breakDeductMs - lunchDeductMs);
          clockInAt = null; breakDeductMs = 0; lunchDeductMs = 0;
        }
        break;
    }
  }
  return totalMs / (1000 * 60 * 60);
}

// ─── Life Bar ─────────────────────────────────────────────────────────────────

function LifeBar({
  label, actual, budget, unit, inverse = false,
}: {
  label: string; actual: number; budget: number | null; unit: "money" | "hours"; inverse?: boolean;
}) {
  const actualStr = unit === "money" ? fmtMoney(actual) : fmtHours(actual);

  if (!budget) {
    if (actual === 0) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span>
          <span className="text-[10px] text-white/35">{actualStr} — no budget set</span>
        </div>
      </div>
    );
  }

  const ratio = budget > 0 ? actual / budget : 0;
  const pct = Math.round(ratio * 100);
  const barWidth = Math.min(ratio, 1);
  const over = pct > 100;

  let barColor: string;
  if (inverse) {
    if (pct >= 100) barColor = "bg-emerald-400";
    else if (pct >= 75) barColor = "bg-emerald-500";
    else if (pct >= 50) barColor = "bg-amber-400";
    else barColor = "bg-red-500";
  } else {
    if (pct >= 100) barColor = "bg-red-500";
    else if (pct >= 90) barColor = "bg-red-400";
    else if (pct >= 75) barColor = "bg-amber-400";
    else barColor = "bg-emerald-500";
  }

  const budgetStr = unit === "money" ? fmtMoney(budget) : fmtHours(budget);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</span>
        <span className="text-[10px] text-white/55">
          {actualStr} / {budgetStr}{" "}
          <span className={over ? "font-semibold text-red-400" : pct >= 75 ? "text-amber-300" : "text-white/40"}>
            {pct}%
          </span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor} ${over ? "opacity-80" : ""}`} style={{ width: `${barWidth * 100}%` }} />
        {over && <div className="absolute right-0 top-0 h-full w-0.5 bg-red-400 opacity-70" />}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  job, expenseCents, revenueCents, hours, onJobUpdated,
}: {
  job: JobRow; expenseCents: number; revenueCents: number; hours: number;
  onJobUpdated: (updated: Partial<JobRow>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [matStr, setMatStr] = useState(job.material_budget_cents != null ? String(job.material_budget_cents / 100) : "");
  const [contractStr, setContractStr] = useState(job.contract_value_cents != null ? String(job.contract_value_cents / 100) : "");
  const [hoursStr, setHoursStr] = useState(job.labour_hours_budget != null ? String(job.labour_hours_budget) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const profitCents = revenueCents - expenseCents;
  const hasBudgets = job.material_budget_cents != null || job.contract_value_cents != null || job.labour_hours_budget != null;
  const hasActivity = expenseCents > 0 || revenueCents > 0 || hours > 0;

  async function saveBudgets() {
    setSaving(true); setErr(null);
    const matCents = matStr.trim() ? Math.round(parseFloat(matStr) * 100) : null;
    const contractCents = contractStr.trim() ? Math.round(parseFloat(contractStr) * 100) : null;
    const hoursVal = hoursStr.trim() ? parseFloat(hoursStr) : null;

    const { error } = await supabase.from("jobs").update({
      material_budget_cents: matCents,
      contract_value_cents: contractCents,
      labour_hours_budget: hoursVal,
    }).eq("id", job.id);

    if (error) { setErr(error.message); setSaving(false); return; }
    onJobUpdated({ material_budget_cents: matCents, contract_value_cents: contractCents, labour_hours_budget: hoursVal });
    setEditing(false); setSaving(false);
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";

  return (
    <div className="space-y-6">
      {/* Life bars */}
      {(hasActivity || hasBudgets) ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Budget health</div>
          <div className="space-y-4">
            <LifeBar label="Materials" actual={expenseCents} budget={job.material_budget_cents ?? null} unit="money" />
            <LifeBar label="Revenue" actual={revenueCents} budget={job.contract_value_cents ?? null} unit="money" inverse />
            <LifeBar label="Labour" actual={hours} budget={job.labour_hours_budget ?? null} unit="hours" />
          </div>

          {(expenseCents > 0 || revenueCents > 0) ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Net</span>
              <span className={`text-sm font-semibold ${profitCents > 0 ? "text-emerald-400" : profitCents < 0 ? "text-red-400" : "text-white/50"}`}>
                {profitCents > 0 ? "+" : ""}{fmtMoney(profitCents)}
              </span>
              {profitCents !== 0 && (
                <span className="text-[10px] text-white/30">{profitCents > 0 ? "profit" : "loss"} so far</span>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
          >
            {hasBudgets ? "Edit budgets" : "Set budgets"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-sm text-white/40 italic mb-3">No expenses, revenue, or hours logged yet.</div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
          >
            Set budgets
          </button>
        </div>
      )}

      {/* Budget edit form */}
      {editing && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Set budgets</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Materials budget ($)</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 8000" value={matStr} onChange={(e) => setMatStr(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Contract value ($)</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 24000" value={contractStr} onChange={(e) => setContractStr(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Labour hours budget</label>
              <input type="number" min="0" step="0.5" placeholder="e.g. 120" value={hoursStr} onChange={(e) => setHoursStr(e.target.value)} className={inputCls} />
            </div>
          </div>
          {err && <div className="text-xs text-red-300">{err}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={saveBudgets} disabled={saving} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Ask Chief shortcut */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-3">Quick actions</div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/app/chief?q=${encodeURIComponent(`Summarise job ${job.job_name || job.name || job.job_no || job.id} — what has been spent, what has been collected, and is it on track?`)}`}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
          >
            Ask Chief about this job
          </a>
          <Link
            href="/app/activity/expenses"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
          >
            View all expenses
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Tab ─────────────────────────────────────────────────────────────

const STAGES = ["lead", "quote", "contract", "active", "invoiced", "paid", "closed"] as const;
const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", quote: "Quote", contract: "Contract",
  active: "Active", invoiced: "Invoiced", paid: "Paid", closed: "Closed",
};
const LEAD_SOURCES = ["whatsapp", "portal", "referral", "ad", "phone", "other"];

function DocumentsTab({
  job, jobDoc, customer, quoteLines, tenantId,
  onDocUpdated, onCustomerUpdated, onQuoteLinesUpdated,
}: {
  job: JobRow;
  jobDoc: JobDocument | null;
  customer: Customer | null;
  quoteLines: QuoteLineItem[];
  tenantId: string;
  onDocUpdated: (updated: Partial<JobDocument>) => void;
  onCustomerUpdated: (c: Customer) => void;
  onQuoteLinesUpdated: (lines: QuoteLineItem[]) => void;
}) {
  const currentStage = jobDoc?.stage ?? "lead";
  const stageIdx = STAGES.indexOf(currentStage as typeof STAGES[number]);

  // ── Lead section state
  const [leadNotes, setLeadNotes] = useState(jobDoc?.lead_notes ?? "");
  const [leadSource, setLeadSource] = useState(jobDoc?.lead_source ?? "");
  const [savingLead, setSavingLead] = useState(false);

  // ── Customer state
  const [custName, setCustName] = useState(customer?.name ?? "");
  const [custPhone, setCustPhone] = useState(customer?.phone ?? "");
  const [custEmail, setCustEmail] = useState(customer?.email ?? "");
  const [custAddress, setCustAddress] = useState(customer?.address ?? "");
  const [savingCust, setSavingCust] = useState(false);
  const [custErr, setCustErr] = useState<string | null>(null);

  // ── Quote state
  const [lines, setLines] = useState<QuoteLineItem[]>(quoteLines);
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");
  const [newCat, setNewCat] = useState("materials");
  const [addingLine, setAddingLine] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [lineErr, setLineErr] = useState<string | null>(null);

  const quoteTotalCents = lines.reduce((sum, l) => sum + Math.round(l.qty * l.unit_price_cents), 0);

  async function ensureJobDoc() {
    if (jobDoc) return jobDoc.id;
    const { data, error } = await supabase.from("job_documents").insert({
      tenant_id: tenantId,
      job_id: job.id,
      stage: "lead",
    }).select("id, stage, lead_notes, lead_source, customer_id").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create document record");
    onDocUpdated(data);
    return data.id;
  }

  async function saveLead() {
    setSavingLead(true);
    try {
      const docId = await ensureJobDoc();
      const { error } = await supabase.from("job_documents").update({
        lead_notes: leadNotes || null,
        lead_source: leadSource || null,
        updated_at: new Date().toISOString(),
      }).eq("id", docId);
      if (!error) onDocUpdated({ lead_notes: leadNotes || null, lead_source: leadSource || null });
    } finally {
      setSavingLead(false);
    }
  }

  async function saveCustomer() {
    if (!custName.trim()) { setCustErr("Name is required."); return; }
    setSavingCust(true); setCustErr(null);
    try {
      const docId = await ensureJobDoc();
      let custId = customer?.id;
      if (custId) {
        await supabase.from("customers").update({
          name: custName.trim(), phone: custPhone.trim() || null,
          email: custEmail.trim() || null, address: custAddress.trim() || null,
        }).eq("id", custId);
      } else {
        const { data } = await supabase.from("customers").insert({
          tenant_id: tenantId, name: custName.trim(),
          phone: custPhone.trim() || null, email: custEmail.trim() || null,
          address: custAddress.trim() || null,
        }).select("id, name, phone, email, address").single();
        if (data) { custId = data.id; }
      }
      if (custId) {
        await supabase.from("job_documents").update({ customer_id: custId }).eq("id", docId);
        onCustomerUpdated({ id: custId!, name: custName.trim(), phone: custPhone.trim() || null, email: custEmail.trim() || null, address: custAddress.trim() || null });
        onDocUpdated({ customer_id: custId });
      }
    } finally {
      setSavingCust(false);
    }
  }

  async function advanceStage(newStage: string) {
    const docId = await ensureJobDoc();
    await supabase.from("job_documents").update({ stage: newStage, updated_at: new Date().toISOString() }).eq("id", docId);
    onDocUpdated({ stage: newStage });
  }

  async function addLine() {
    if (!newDesc.trim()) { setLineErr("Description is required."); return; }
    const priceCents = Math.round(parseFloat(newPrice || "0") * 100);
    const qty = parseFloat(newQty || "1");
    if (isNaN(priceCents) || priceCents < 0 || isNaN(qty) || qty <= 0) {
      setLineErr("Enter valid qty and price."); return;
    }
    setSavingLine(true); setLineErr(null);
    const docId = await ensureJobDoc();
    void docId; // ensure doc exists
    const { data, error } = await supabase.from("quote_line_items").insert({
      job_id: job.id, tenant_id: tenantId,
      description: newDesc.trim(), qty, unit_price_cents: priceCents,
      category: newCat, sort_order: lines.length,
    }).select("id, description, qty, unit_price_cents, category, sort_order").single();
    if (error) { setLineErr(error.message); setSavingLine(false); return; }
    const newLine = data as QuoteLineItem;
    const updated = [...lines, newLine];
    setLines(updated);
    onQuoteLinesUpdated(updated);
    setNewDesc(""); setNewQty("1"); setNewPrice(""); setAddingLine(false);
    setSavingLine(false);
  }

  async function deleteLine(id: string) {
    await supabase.from("quote_line_items").delete().eq("id", id);
    const updated = lines.filter((l) => l.id !== id);
    setLines(updated);
    onQuoteLinesUpdated(updated);
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";
  const sectionCls = "rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden";

  return (
    <div className="space-y-4">

      {/* Stage progress */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-3">Stage</div>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => advanceStage(s)}
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-medium border transition",
                  s === currentStage
                    ? "border-white/20 bg-white text-black"
                    : i <= stageIdx
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60",
                ].join(" ")}
              >
                {STAGE_LABELS[s]}
              </button>
              {i < STAGES.length - 1 && <span className="text-white/15 text-xs">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── LEAD ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="text-sm font-semibold text-white/90">Lead</div>
          <div className="text-xs text-white/40 mt-0.5">First contact details and job notes</div>
        </div>
        <div className="p-5 space-y-4">

          {/* Customer */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Customer</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Name *</label>
                <input type="text" placeholder="e.g. John Smith" value={custName} onChange={(e) => setCustName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Phone</label>
                <input type="tel" placeholder="e.g. +1 416 555 0100" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Email</label>
                <input type="email" placeholder="e.g. john@example.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Address</label>
                <input type="text" placeholder="Job site address" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} className={inputCls} />
              </div>
            </div>
            {custErr && <div className="text-xs text-red-300">{custErr}</div>}
            <button type="button" onClick={saveCustomer} disabled={savingCust} className="rounded-xl bg-white/8 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/12 transition disabled:opacity-50">
              {savingCust ? "Saving…" : customer ? "Update customer" : "Save customer"}
            </button>
          </div>

          {/* Lead notes + source */}
          <div className="space-y-3 pt-2 border-t border-white/8">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Lead details</div>
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Notes (what the client wants)</label>
              <textarea
                rows={3}
                placeholder="e.g. Replace roof on 2-storey, 40 sq. Wants architectural shingles. Needs quote by Friday."
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-white/50">How did they find you?</label>
              <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} className={inputCls}>
                <option value="">— Select source —</option>
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <button type="button" onClick={saveLead} disabled={savingLead} className="rounded-xl bg-white/8 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/12 transition disabled:opacity-50">
              {savingLead ? "Saving…" : "Save notes"}
            </button>
          </div>

          {/* Advance to quote */}
          {currentStage === "lead" && (
            <div className="pt-2 border-t border-white/8">
              <button
                type="button"
                onClick={() => advanceStage("quote")}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition"
              >
                Ready to quote → Move to Quote stage
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── QUOTE ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white/90">Quote</div>
              <div className="text-xs text-white/40 mt-0.5">Line items and pricing</div>
            </div>
            {lines.length > 0 && (
              <div className="text-right">
                <div className="text-[10px] text-white/40">Total</div>
                <div className="text-lg font-semibold text-white/90">{fmtMoney(quoteTotalCents)}</div>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 space-y-4">

          {/* Line items list */}
          {lines.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] uppercase tracking-[0.14em] text-white/35 px-1">
                <span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span>
              </div>
              {lines
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((l) => (
                  <div key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                    <div>
                      <div className="text-sm text-white/85">{l.description}</div>
                      {l.category && <div className="text-[10px] text-white/35 capitalize">{l.category}</div>}
                    </div>
                    <span className="text-sm text-white/60">{l.qty % 1 === 0 ? l.qty.toFixed(0) : l.qty.toFixed(1)}</span>
                    <span className="text-sm text-white/60">{fmtMoney(l.unit_price_cents)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80">{fmtMoney(Math.round(l.qty * l.unit_price_cents))}</span>
                      <button type="button" onClick={() => deleteLine(l.id)} className="text-white/20 hover:text-red-400 transition text-xs">✕</button>
                    </div>
                  </div>
                ))}
              <div className="flex justify-end gap-2 pt-1 border-t border-white/8 px-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Quote total</span>
                <span className="text-sm font-semibold text-white/90">{fmtMoney(quoteTotalCents)}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/35 italic">No line items yet. Add items below.</div>
          )}

          {/* Add line item */}
          {addingLine ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Add line item</div>
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Description *</label>
                <input type="text" placeholder="e.g. Architectural shingles — 40 sq" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-white/50">Qty</label>
                  <input type="number" min="0.01" step="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/50">Unit price ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-white/50">Category</label>
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={inputCls}>
                    <option value="materials">Materials</option>
                    <option value="labour">Labour</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              {newDesc && newPrice && (
                <div className="text-xs text-white/45">
                  Line total: {fmtMoney(Math.round((parseFloat(newQty || "1") || 1) * Math.round(parseFloat(newPrice || "0") * 100)))}
                </div>
              )}
              {lineErr && <div className="text-xs text-red-300">{lineErr}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={addLine} disabled={savingLine} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">
                  {savingLine ? "Adding…" : "Add item"}
                </button>
                <button type="button" onClick={() => { setAddingLine(false); setLineErr(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingLine(true)} className="rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs font-medium text-white/50 hover:border-white/25 hover:text-white/70 transition w-full text-center">
              + Add line item
            </button>
          )}

          {/* Auto-set contract value from quote */}
          {lines.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/8">
              <button
                type="button"
                onClick={async () => {
                  await supabase.from("jobs").update({ contract_value_cents: quoteTotalCents }).eq("id", job.id);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
              >
                Set contract value from quote total ({fmtMoney(quoteTotalCents)})
              </button>
              {currentStage === "quote" && (
                <button
                  type="button"
                  onClick={() => advanceStage("contract")}
                  className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition"
                >
                  Quote accepted → Move to Contract
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTRACT (coming soon) ── */}
      <ComingSoonSection title="Contract" description="Generate a PDF contract from your quote, send it to the client, and capture their e-signature." />

      {/* ── CHANGE ORDERS (coming soon) ── */}
      <ComingSoonSection title="Change Orders" description="Log scope changes, generate CO documents, and track approval signatures." />

      {/* ── FINAL INVOICE (coming soon) ── */}
      <ComingSoonSection title="Final Invoice" description="Auto-build the invoice from your quote and approved change orders, attach before/after photos, and send." />

      {/* ── RECEIPT + REFERRAL (coming soon) ── */}
      <ComingSoonSection title="Receipt & Referral" description="Send a payment receipt and a referral/review request when the job is done." />
    </div>
  );
}

function ComingSoonSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden opacity-60">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white/50">{title}</div>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/35">Coming soon</span>
        </div>
        <div className="text-xs text-white/30 mt-0.5">{description}</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const params = useParams();
  const jobId = Number(params.jobId);
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [job, setJob] = useState<JobRow | null>(null);
  const [expenseCents, setExpenseCents] = useState(0);
  const [revenueCents, setRevenueCents] = useState(0);
  const [hours, setHours] = useState(0);
  const [jobDoc, setJobDoc] = useState<JobDocument | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quoteLines, setQuoteLines] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || isNaN(jobId)) return;
    setLoading(true);
    try {
      // 1. Job
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id, job_no, job_name, name, status, active, start_date, end_date, material_budget_cents, labour_hours_budget, contract_value_cents")
        .eq("id", jobId)
        .single();
      if (!jobData) { setNotFound(true); setLoading(false); return; }
      setJob(jobData as JobRow);

      // 2. Expenses
      const { data: expData } = await supabase
        .from("chiefos_portal_expenses")
        .select("amount_cents")
        .eq("job_int_id", jobId)
        .is("deleted_at", null);
      setExpenseCents((expData || []).reduce((s, r) => s + Number(r.amount_cents || 0), 0));

      // 3. Revenue
      const { data: revData } = await supabase
        .from("chiefos_portal_revenue")
        .select("amount_cents")
        .eq("job_int_id", jobId)
        .is("deleted_at", null);
      setRevenueCents((revData || []).reduce((s, r) => s + Number(r.amount_cents || 0), 0));

      // 4. Labour hours
      if ((jobData as JobRow).job_no != null) {
        const { data: timeData } = await supabase
          .from("time_entries")
          .select("job_no, type, timestamp")
          .eq("job_no", (jobData as JobRow).job_no)
          .is("deleted_at", null);
        setHours(calcWorkHours((timeData as TimeEntry[]) || []));
      }

      // 5. Job document record
      const { data: docData } = await supabase
        .from("job_documents")
        .select("id, stage, lead_notes, lead_source, customer_id")
        .eq("job_id", jobId)
        .maybeSingle();
      if (docData) {
        setJobDoc(docData as JobDocument);
        // 6. Customer
        if (docData.customer_id) {
          const { data: custData } = await supabase
            .from("customers")
            .select("id, name, phone, email, address")
            .eq("id", docData.customer_id)
            .single();
          if (custData) setCustomer(custData as Customer);
        }
      }

      // 7. Quote line items
      const { data: linesData } = await supabase
        .from("quote_line_items")
        .select("id, description, qty, unit_price_cents, category, sort_order")
        .eq("job_id", jobId)
        .order("sort_order");
      setQuoteLines((linesData as QuoteLineItem[]) || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [jobId, tenantId]);

  useEffect(() => {
    if (!gateLoading && tenantId) void load();
  }, [gateLoading, tenantId, load]);

  if (gateLoading || loading) {
    return <div className="p-8 text-sm text-white/60">Loading…</div>;
  }
  if (notFound || !job) {
    return (
      <div className="p-8 text-center">
        <div className="text-white/60 mb-4">Job not found.</div>
        <Link href="/app/jobs" className="text-sm text-white/50 underline">← Back to jobs</Link>
      </div>
    );
  }

  const title = String(job.job_name || job.name || "Untitled job");
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents" },
    { key: "activity", label: "Activity" },
    { key: "photos", label: "Photos" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">

        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/app/jobs" className="text-[11px] text-white/40 hover:text-white/60 transition">
            ← All jobs
          </Link>
        </div>

        {/* Job header */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            {job.job_no ? `Job #${job.job_no}` : "Job"}
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white/95">{title}</h1>
          {(job.start_date || job.end_date) && (
            <div className="mt-1 text-sm text-white/40">
              {job.start_date && <span>Started {new Date(job.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
              {job.end_date && <span> · Ends {new Date(job.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
            </div>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mb-8 border-b border-white/10 pb-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px",
                tab === t.key
                  ? "border-white text-white"
                  : "border-transparent text-white/45 hover:text-white/70",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <OverviewTab
            job={job}
            expenseCents={expenseCents}
            revenueCents={revenueCents}
            hours={hours}
            onJobUpdated={(updated) => setJob((j) => j ? { ...j, ...updated } : j)}
          />
        )}

        {tab === "documents" && tenantId && (
          <DocumentsTab
            job={job}
            jobDoc={jobDoc}
            customer={customer}
            quoteLines={quoteLines}
            tenantId={tenantId}
            onDocUpdated={(updated) => setJobDoc((d) => d ? { ...d, ...updated } : { id: "", stage: "lead", lead_notes: null, lead_source: null, customer_id: null, ...updated })}
            onCustomerUpdated={(c) => setCustomer(c)}
            onQuoteLinesUpdated={(lines) => setQuoteLines(lines)}
          />
        )}

        {tab === "activity" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <div className="text-sm text-white/50 mb-4">Activity filtered to this job is available on the main Activity pages.</div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/app/activity/expenses" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition">
                Expenses
              </Link>
              <Link href="/app/activity/revenue" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition">
                Revenue
              </Link>
              <Link href="/app/activity/tasks" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition">
                Tasks
              </Link>
            </div>
          </div>
        )}

        {tab === "photos" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <div className="text-sm text-white/50">
              Photo gallery coming soon. Photos sent via WhatsApp will appear here, tagged by job.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
