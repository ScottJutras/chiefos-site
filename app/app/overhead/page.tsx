"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

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
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthlyEquivalent(item: Pick<OverheadItem, "item_type" | "amount_cents" | "frequency" | "amortization_months">): number {
  if (item.item_type === "amortized") {
    return item.amortization_months ? Math.round(item.amount_cents / item.amortization_months) : 0;
  }
  if (item.frequency === "weekly") return Math.round((item.amount_cents * 52) / 12);
  if (item.frequency === "annual") return Math.round(item.amount_cents / 12);
  return item.amount_cents;
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
}: {
  initial?: FormState;
  onSave: (item: OverheadItem) => void;
  onCancel: () => void;
  tenantId: string;
  editId?: string;
}) {
  const [form, setForm] = useState<FormState>(initial ?? blankForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      category: form.category,
      item_type: form.item_type,
      amount_cents: amountCents,
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
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-white/50">Amount ($) *</label>
            <input type="number" min="0.01" step="0.01" placeholder="e.g. 2000" value={form.amount}
              onChange={(e) => set("amount", e.target.value)} className={inputCls} />
          </div>
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
            {fmtMoney(monthlyEquivalent({
              item_type: form.item_type,
              amount_cents: Math.round(parseFloat(form.amount) * 100),
              frequency: form.frequency,
              amortization_months: form.amortization_months.trim() ? parseInt(form.amortization_months, 10) : null,
            }))}/mo
          </span>
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

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;

    (async () => {
      const [itemsRes, revRes] = await Promise.all([
        supabase.from("overhead_items").select("*").eq("tenant_id", tenantId).order("created_at"),
        (async () => {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          return supabase.from("transactions")
            .select("amount_cents")
            .eq("tenant_id", tenantId)
            .eq("kind", "revenue")
            .gte("date", monthStart);
        })(),
      ]);

      if (!alive) return;
      setItems((itemsRes.data as OverheadItem[]) || []);
      const rev = ((revRes.data as any[]) || []).reduce((s, r) => s + Number(r.amount_cents || 0), 0);
      setMtdRevenue(rev);
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
              const status = dueStatus(item.due_day!, todayDay);
              const monthly = monthlyEquivalent(item);
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/85 truncate">{item.name}</div>
                    <div className="text-[11px] text-white/40">
                      {CATEGORY_LABELS[item.category]} · Due {item.due_day}{item.due_day === 1 ? "st" : item.due_day === 2 ? "nd" : item.due_day === 3 ? "rd" : "th"} of month
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-white/80">{fmtMoney(monthly)}</span>
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      status === "overdue" ? "bg-red-500/15 border border-red-500/30 text-red-400"
                        : status === "soon" ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                        : "bg-white/8 border border-white/10 text-white/40",
                    ].join(" ")}>
                      {status === "overdue" ? "Overdue" : status === "soon" ? "Due soon" : "Upcoming"}
                    </span>
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
                            </div>
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
