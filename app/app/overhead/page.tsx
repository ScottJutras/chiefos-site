"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

// ─── Tax helpers ──────────────────────────────────────────────────────────────

const TAX_CODE_RATES: Record<string, number> = {
  HST_ON: 0.13, HST_NS: 0.15, HST_NB: 0.15, HST_NL: 0.15, HST_PE: 0.15,
  GST_PST_BC: 0.12, GST_PST_SK: 0.11, GST_PST_MB: 0.12, GST_PST_QC: 0.14975,
  GST_ONLY: 0.05, NO_SALES_TAX: 0,
};

const US_STATE_RATES: Record<string, number> = {
  AL: 0.04, AK: 0.00, AZ: 0.056, AR: 0.065, CA: 0.0725, CO: 0.029,
  CT: 0.0635, DE: 0.00, FL: 0.06, GA: 0.04, HI: 0.04, ID: 0.06,
  IL: 0.0625, IN: 0.07, IA: 0.06, KS: 0.065, KY: 0.06, LA: 0.0445,
  ME: 0.055, MD: 0.06, MA: 0.0625, MI: 0.06, MN: 0.0688, MS: 0.07,
  MO: 0.0423, MT: 0.00, NE: 0.055, NV: 0.0685, NH: 0.00, NJ: 0.0663,
  NM: 0.0488, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575, OK: 0.045,
  OR: 0.00, PA: 0.06, RI: 0.07, SC: 0.06, SD: 0.042, TN: 0.07,
  TX: 0.0625, UT: 0.061, VT: 0.06, VA: 0.053, WA: 0.065, WV: 0.06,
  WI: 0.05, WY: 0.04, DC: 0.06,
};

function taxRateFromCode(taxCode: string | null, province?: string | null): number {
  if (!taxCode) return 0;
  if (taxCode === "US_SALES_TAX") return US_STATE_RATES[province ?? ""] ?? 0;
  return TAX_CODE_RATES[taxCode] ?? 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemType = "recurring" | "amortized";
type Frequency = "monthly" | "weekly" | "annual";
type Category = "facility" | "vehicle" | "equipment" | "insurance" | "payroll" | "other";

type OverheadItem = {
  id: string;
  tenant_id: string;
  name: string;
  category: Category;
  item_type: ItemType;
  amount_cents: number;
  frequency: Frequency;
  due_day: number | null;
  amortization_months: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  active: boolean;
  tax_amount_cents: number | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthlyEquivalent(item: Pick<OverheadItem, "item_type" | "amount_cents" | "frequency" | "amortization_months" | "tax_amount_cents">): number {
  if (item.item_type === "amortized") {
    return item.amortization_months ? Math.round(item.amount_cents / item.amortization_months) : 0;
  }
  const tax = item.tax_amount_cents ?? 0;
  if (item.frequency === "weekly") return Math.round(((item.amount_cents + tax) * 52) / 12);
  if (item.frequency === "annual") return Math.round((item.amount_cents + tax) / 12);
  return item.amount_cents + tax;
}

function fmtMoney(cents: number) {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  if (abs >= 1_000_000_00) return `${sign}$${Math.round(abs / 100_00) / 10}M`;
  if (abs >= 10_000_00) return `${sign}$${Math.round(abs / 100_0) / 10}k`;
  return `${sign}$${(abs / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const CATEGORY_LABELS: Record<Category, string> = {
  facility:  "Facility",
  vehicle:   "Vehicle",
  equipment: "Equipment",
  insurance: "Insurance",
  payroll:   "Payroll / Admin",
  other:     "Other",
};

const CATEGORY_ORDER: Category[] = ["facility", "vehicle", "equipment", "insurance", "payroll", "other"];

function dueStatus(dueDay: number, todayDay: number): "overdue" | "soon" | "upcoming" {
  if (dueDay < todayDay) return "overdue";
  if (dueDay - todayDay <= 7) return "soon";
  return "upcoming";
}

// ─── Blank form state ─────────────────────────────────────────────────────────

type FormState = {
  name: string;
  category: Category;
  item_type: ItemType;
  amount: string;
  tax_amount: string;
  frequency: Frequency;
  due_day: string;
  amortization_months: string;
  start_date: string;
  notes: string;
};

function blankForm(): FormState {
  return {
    name: "",
    category: "other",
    item_type: "recurring",
    amount: "",
    tax_amount: "",
    frequency: "monthly",
    due_day: "",
    amortization_months: "",
    start_date: "",
    notes: "",
  };
}

function itemToForm(item: OverheadItem): FormState {
  return {
    name: item.name,
    category: item.category,
    item_type: item.item_type,
    amount: item.amount_cents > 0 ? String(item.amount_cents / 100) : "",
    tax_amount: item.tax_amount_cents != null ? String(item.tax_amount_cents / 100) : "",
    frequency: item.frequency,
    due_day: item.due_day != null ? String(item.due_day) : "",
    amortization_months: item.amortization_months != null ? String(item.amortization_months) : "",
    start_date: item.start_date ?? "",
    notes: item.notes ?? "",
  };
}

// ─── Add/Edit Form ────────────────────────────────────────────────────────────

function ItemForm({
  initial,
  onSave,
  onCancel,
  tenantId,
  editId,
  taxRate,
}: {
  initial?: FormState;
  onSave: (item: OverheadItem) => void;
  onCancel: () => void;
  tenantId: string;
  editId?: string;
  taxRate: number;
}) {
  const [form, setForm] = useState<FormState>(initial ?? blankForm());
  const [taxManual, setTaxManual] = useState(() => !!(initial?.tax_amount));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-calculate tax when amount changes (unless user has manually set it)
  useEffect(() => {
    if (taxManual || taxRate === 0) return;
    const amt = parseFloat(form.amount);
    if (!isNaN(amt) && amt > 0) {
      const computed = (amt * taxRate).toFixed(2);
      setForm((f) => ({ ...f, tax_amount: computed }));
    } else {
      setForm((f) => ({ ...f, tax_amount: "" }));
    }
  }, [form.amount, taxRate, taxManual]);

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";
  const isRecurring = form.item_type === "recurring";

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.name.trim()) { setErr("Name is required."); return; }
    const amountCents = Math.round(parseFloat(form.amount || "0") * 100);
    if (!form.amount.trim() || isNaN(amountCents) || amountCents <= 0) {
      setErr("Enter a valid amount greater than $0."); return;
    }
    if (form.item_type === "amortized") {
      const months = parseInt(form.amortization_months || "0", 10);
      if (!months || months < 1) { setErr("Enter a useful life in months (e.g. 60)."); return; }
    }

    setSaving(true); setErr(null);

    const taxCents = isRecurring && form.tax_amount.trim()
      ? Math.round(parseFloat(form.tax_amount) * 100)
      : null;

    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      category: form.category,
      item_type: form.item_type,
      amount_cents: amountCents,
      tax_amount_cents: (taxCents != null && !isNaN(taxCents) && taxCents >= 0) ? taxCents : null,
      frequency: form.frequency,
      due_day: isRecurring && form.due_day.trim() ? parseInt(form.due_day, 10) : null,
      amortization_months: !isRecurring && form.amortization_months.trim()
        ? parseInt(form.amortization_months, 10) : null,
      start_date: form.start_date.trim() || null,
      notes: form.notes.trim() || null,
      active: true,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editId) {
        const { data, error } = await supabase
          .from("overhead_items").update(payload).eq("id", editId)
          .select().single();
        if (error) throw error;
        onSave(data as OverheadItem);
      } else {
        const { data, error } = await supabase
          .from("overhead_items").insert(payload)
          .select().single();
        if (error) throw error;
        onSave(data as OverheadItem);
      }
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
        {editId ? "Edit item" : "New overhead item"}
      </div>

      {/* Name + Category row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Name *</label>
          <input type="text" placeholder="e.g. Shop Rent, Ford F-150 Lease" value={form.name}
            onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Category</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value as Category)}
            className={inputCls}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type toggle */}
      <div>
        <label className="mb-2 block text-[11px] text-white/50">Type</label>
        <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 gap-1">
          {(["recurring", "amortized"] as const).map((t) => (
            <button key={t} type="button" onClick={() => set("item_type", t)}
              className={["rounded-lg px-4 py-1.5 text-xs font-medium transition",
                form.item_type === t ? "bg-white text-black" : "text-white/60 hover:text-white/85",
              ].join(" ")}>
              {t === "recurring" ? "Recurring bill" : "Amortized asset"}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-white/35">
          {isRecurring
            ? "Rent, leases, insurance, subscriptions — bills that come every week/month/year."
            : "Equipment or vehicles you own — spread the cost over their useful life."}
        </p>
      </div>

      {/* Amount + conditional fields */}
      {isRecurring ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Amount ($) *</label>
              <input type="number" min="0.01" step="0.01" placeholder="e.g. 2000" value={form.amount}
                onChange={(e) => set("amount", e.target.value)} className={inputCls} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] text-white/50">
                  Tax ({taxRate > 0 ? `${(taxRate * 100).toFixed(taxRate % 0.01 !== 0 ? 3 : 0)}%` : "—"})
                </label>
                {taxManual && (
                  <button type="button" onClick={() => setTaxManual(false)}
                    className="text-[10px] text-white/30 hover:text-white/60 transition">
                    Reset to auto
                  </button>
                )}
              </div>
              <input
                type="number" min="0" step="0.01" placeholder={taxRate > 0 ? "Auto-calculated" : "Enter tax amount"}
                value={form.tax_amount}
                onChange={(e) => { set("tax_amount", e.target.value); setTaxManual(true); }}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Frequency</label>
              <select value={form.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)}
                className={inputCls}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Due day (1–28)</label>
              <input type="number" min="1" max="28" placeholder="e.g. 1" value={form.due_day}
                onChange={(e) => set("due_day", e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-white/50">Total asset value ($) *</label>
            <input type="number" min="0.01" step="0.01" placeholder="e.g. 35000" value={form.amount}
              onChange={(e) => set("amount", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-white/50">Useful life (months) *</label>
            <input type="number" min="1" step="1" placeholder="e.g. 60" value={form.amortization_months}
              onChange={(e) => set("amortization_months", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-white/50">Start date</label>
            <input type="date" value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1 block text-[11px] text-white/50">Notes (optional)</label>
        <input type="text" placeholder="e.g. Due to TD Bank, account #..." value={form.notes}
          onChange={(e) => set("notes", e.target.value)} className={inputCls} />
      </div>

      {/* Monthly preview */}
      {form.amount.trim() && parseFloat(form.amount) > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-sm">
          <span className="text-white/45">Monthly equivalent: </span>
          <span className="font-semibold text-white/85">
            ${(monthlyEquivalent({
              item_type: form.item_type,
              amount_cents: Math.round(parseFloat(form.amount) * 100),
              tax_amount_cents: isRecurring && form.tax_amount.trim() ? Math.round(parseFloat(form.tax_amount) * 100) : null,
              frequency: form.frequency,
              amortization_months: form.amortization_months.trim() ? parseInt(form.amortization_months, 10) : null,
            }) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
          </span>
          {isRecurring && form.tax_amount.trim() && parseFloat(form.tax_amount) > 0 && (
            <span className="ml-2 text-[11px] text-white/35">
              incl. {fmtMoney(Math.round(parseFloat(form.tax_amount) * 100))} tax
            </span>
          )}
        </div>
      )}

      {err && <div className="text-xs text-red-300">{err}</div>}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving}
          className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">
          {saving ? "Saving…" : editId ? "Save changes" : "Add item"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverheadPage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [items, setItems] = useState<OverheadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mtdRevenue, setMtdRevenue] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<OverheadItem | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [paidItemIds, setPaidItemIds] = useState<Set<string>>(new Set());
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;

    (async () => {
      const now = new Date();
      const currentYear  = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const [itemsRes, revRes, tenantRes, paymentsRes] = await Promise.all([
        supabase.from("overhead_items").select("*").eq("tenant_id", tenantId).order("created_at"),
        (async () => {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          return supabase.from("transactions")
            .select("amount_cents")
            .eq("tenant_id", tenantId)
            .eq("kind", "revenue")
            .gte("date", monthStart);
        })(),
        supabase.from("chiefos_tenants").select("tax_code, province").eq("id", tenantId).single(),
        supabase.from("overhead_payments")
          .select("item_id")
          .eq("tenant_id", tenantId)
          .eq("period_year", currentYear)
          .eq("period_month", currentMonth),
      ]);

      if (!alive) return;
      setItems((itemsRes.data as OverheadItem[]) || []);
      const rev = ((revRes.data as any[]) || []).reduce((s, r) => s + Number(r.amount_cents || 0), 0);
      setMtdRevenue(rev);
      if (tenantRes.data) {
        setTaxRate(taxRateFromCode(tenantRes.data.tax_code, tenantRes.data.province));
      }
      const paid = new Set<string>((paymentsRes.data as any[] || []).map((p) => p.item_id));
      setPaidItemIds(paid);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [tenantId]);

  const activeItems = useMemo(() => items.filter((i) => i.active), [items]);

  const monthlyBurden = useMemo(
    () => activeItems.reduce((s, i) => s + monthlyEquivalent(i), 0),
    [activeItems]
  );

  const dueItems = useMemo(
    () => activeItems
      .filter((i) => i.item_type === "recurring" && i.due_day != null)
      .sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99)),
    [activeItems]
  );

  const dueSumThisMonth = useMemo(
    () => dueItems.reduce((s, i) => s + monthlyEquivalent(i), 0),
    [dueItems]
  );

  const stillNeeded = Math.max(0, monthlyBurden - mtdRevenue);

  const todayDay = new Date().getDate();

  // Group active items by category
  const grouped = useMemo(() => {
    const map: Partial<Record<Category, OverheadItem[]>> = {};
    for (const item of activeItems) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category]!.push(item);
    }
    return map;
  }, [activeItems]);

  const inactiveItems = useMemo(() => items.filter((i) => !i.active), [items]);

  async function markPaid(itemId: string) {
    setMarkingPaid(itemId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || "";
      const res = await fetch("/api/overhead/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: itemId }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setPaidItemIds((prev) => new Set([...prev, itemId]));
    } catch (e: any) {
      console.error("[markPaid]", e?.message);
    } finally {
      setMarkingPaid(null);
    }
  }

  async function deactivate(id: string) {
    await supabase.from("overhead_items").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, active: false } : i));
  }

  async function reactivate(id: string) {
    await supabase.from("overhead_items").update({ active: true, updated_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, active: true } : i));
  }

  function onSaved(item: OverheadItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = item; return next;
      }
      return [...prev, item];
    });
    setShowForm(false);
    setEditItem(null);
  }

  if (gateLoading || loading) return <div className="p-8 text-sm text-white/60">Loading overhead…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Business</div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">Overhead & Obligations</h1>
          <p className="mt-1.5 text-sm text-white/50">
            Track your fixed costs to see your true profit margin and know what's coming due.
          </p>
        </div>
        {!showForm && !editItem && (
          <button type="button" onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition">
            + Add item
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Monthly burden", value: fmtMoney(monthlyBurden), sub: "Fixed overhead/mo", color: "text-white/90" },
          { label: "Due this month", value: fmtMoney(dueSumThisMonth), sub: `${dueItems.length} item${dueItems.length !== 1 ? "s" : ""}`, color: "text-amber-300" },
          { label: "MTD revenue", value: fmtMoney(mtdRevenue), sub: "This month so far", color: "text-emerald-400" },
          {
            label: "Still needed",
            value: stillNeeded > 0 ? fmtMoney(stillNeeded) : "Covered ✓",
            sub: stillNeeded > 0 ? "To cover overhead" : "Overhead covered",
            color: stillNeeded > 0 ? "text-red-400" : "text-emerald-400",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">{card.label}</div>
            <div className={`mt-2 text-xl font-semibold ${card.color}`}>{card.value}</div>
            <div className="mt-1 text-xs text-white/40">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && tenantId && (
        <ItemForm
          tenantId={tenantId}
          taxRate={taxRate}
          onSave={onSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Due this month */}
      {dueItems.length > 0 && (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-white/40">Due this month</div>
          <div className="space-y-2">
            {dueItems.map((item) => {
              const paid    = paidItemIds.has(item.id);
              const status  = dueStatus(item.due_day!, todayDay);
              const monthly = monthlyEquivalent(item);
              return (
                <div key={item.id} className={["flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
                  paid ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/8 bg-black/20",
                ].join(" ")}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/85 truncate">{item.name}</div>
                    <div className="text-[11px] text-white/40">
                      {CATEGORY_LABELS[item.category]} · Due {item.due_day}{item.due_day === 1 ? "st" : item.due_day === 2 ? "nd" : item.due_day === 3 ? "rd" : "th"} of month
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-white/80">{fmtMoney(monthly)}</span>
                    {paid ? (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Paid ✓
                      </span>
                    ) : (
                      <>
                        <span className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          status === "overdue" ? "bg-red-500/15 border border-red-500/30 text-red-400"
                            : status === "soon" ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                            : "bg-white/8 border border-white/10 text-white/40",
                        ].join(" ")}>
                          {status === "overdue" ? "Overdue" : status === "soon" ? "Due soon" : "Upcoming"}
                        </span>
                        <button
                          type="button"
                          onClick={() => markPaid(item.id)}
                          disabled={markingPaid === item.id}
                          className="rounded-lg bg-white/10 border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/15 transition disabled:opacity-40"
                        >
                          {markingPaid === item.id ? "Saving…" : "Mark paid"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* All active items grouped by category */}
      {activeItems.length === 0 && !showForm ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center">
          <div className="text-sm font-semibold text-white/60">No overhead items yet</div>
          <div className="mt-2 text-sm text-white/35">
            Add rent, vehicle leases, equipment loans, insurance — anything you pay to keep the business running.
          </div>
          <button type="button" onClick={() => setShowForm(true)}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition">
            + Add first item
          </button>
        </div>
      ) : (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 space-y-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">All overhead items</div>
          {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
            <div key={cat}>
              <div className="mb-2 text-xs font-semibold text-white/50">{CATEGORY_LABELS[cat]}</div>
              <div className="space-y-2">
                {grouped[cat]!.map((item) => {
                  const monthly = monthlyEquivalent(item);
                  const isEditing = editItem?.id === item.id;
                  return (
                    <div key={item.id}>
                      {isEditing && tenantId ? (
                        <ItemForm
                          initial={itemToForm(item)}
                          editId={item.id}
                          tenantId={tenantId}
                          taxRate={taxRate}
                          onSave={onSaved}
                          onCancel={() => setEditItem(null)}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-white/85 truncate">{item.name}</span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
                                {item.item_type === "amortized"
                                  ? `Amortized over ${item.amortization_months}mo`
                                  : item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}
                              </span>
                              {item.due_day && (
                                <span className="text-[10px] text-white/35">Due {item.due_day}{item.due_day === 1 ? "st" : item.due_day === 2 ? "nd" : item.due_day === 3 ? "rd" : "th"}</span>
                              )}
                            </div>
                            {item.notes && (
                              <div className="mt-0.5 text-[11px] text-white/35 truncate">{item.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-white/80">{fmtMoney(monthly)}/mo</div>
                              {item.item_type === "amortized" && (
                                <div className="text-[10px] text-white/35">of {fmtMoney(item.amount_cents)} total</div>
                              )}
                              {item.item_type === "recurring" && item.tax_amount_cents != null && item.tax_amount_cents > 0 && (
                                <div className="text-[10px] text-white/35">incl. {fmtMoney(item.tax_amount_cents)} tax</div>
                              )}
                            </div>
                            {item.item_type === "recurring" && item.due_day != null && (
                              paidItemIds.has(item.id) ? (
                                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                  Paid ✓
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markPaid(item.id)}
                                  disabled={markingPaid === item.id}
                                  className="rounded-lg bg-white/8 border border-white/15 px-2 py-0.5 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/12 transition disabled:opacity-40"
                                >
                                  {markingPaid === item.id ? "…" : "Mark paid"}
                                </button>
                              )
                            )}
                            <button type="button" onClick={() => { setEditItem(item); setShowForm(false); }}
                              className="text-xs text-white/35 hover:text-white/70 transition px-1">Edit</button>
                            <button type="button" onClick={() => deactivate(item.id)}
                              className="text-xs text-white/25 hover:text-red-400 transition px-1">Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Monthly total footer */}
          <div className="flex items-center justify-between border-t border-white/8 pt-4">
            <span className="text-sm text-white/50">Total monthly overhead</span>
            <span className="text-base font-semibold text-white/90">{fmtMoney(monthlyBurden)}/mo</span>
          </div>
        </section>
      )}

      {/* Inactive items */}
      {inactiveItems.length > 0 && (
        <section className="rounded-[28px] border border-white/8 bg-white/[0.02] p-5">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-white/25">Inactive</div>
          <div className="space-y-2">
            {inactiveItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 opacity-50">
                <div className="text-sm text-white/60 truncate">{item.name}</div>
                <button type="button" onClick={() => reactivate(item.id)}
                  className="text-xs text-white/35 hover:text-white/70 transition shrink-0">Reactivate</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pricing tip */}
      {monthlyBurden > 0 && (
        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40 mb-3">Pricing guidance</div>
          <div className="space-y-2 text-sm text-white/60">
            <div>
              Your overhead is{" "}
              <span className="font-semibold text-white/85">{fmtMoney(monthlyBurden)}/month</span>.
              Every job you take on needs to contribute to covering this.
            </div>
            <div className="grid gap-3 sm:grid-cols-3 mt-4">
              {[10, 20, 40].map((hrs) => (
                <div key={hrs} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">At {hrs} billable hrs/mo</div>
                  <div className="mt-1 text-base font-semibold text-white/80">
                    {fmtMoney(Math.round(monthlyBurden / hrs))}/hr
                  </div>
                  <div className="text-[11px] text-white/35">overhead per hour</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/35 mt-2">
              Add your labour rate and materials margin on top of this to price profitably.
            </p>
          </div>
        </section>
      )}

      {/* Link to books */}
      <div className="text-center">
        <Link href="/app/activity/expenses" className="text-xs text-white/30 hover:text-white/60 transition">
          View all job expenses in My Books →
        </Link>
      </div>
    </div>
  );
}
