// app/app/expenses/trash/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTenantGate } from "@/lib/useTenantGate";
import { useToast } from "@/app/components/Toast";

type Expense = {
  id: string;
  amount: number;
  vendor: string | null;
  description: string | null;
  expense_date: string;
  job_name: string | null;
  deleted_at: string | null;
};

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function money(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "$0.00";
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

export default function TrashPage() {
  const router = useRouter();
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: true });
  const toast = useToast();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [q, setQ] = useState("");

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("chiefos_expenses")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false });

        if (error) throw error;

        if (!cancelled) setRows((data ?? []) as Expense[]);
      } catch (e: any) {
        if (!cancelled) {
          console.warn(e?.message ?? "Failed to load trash.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;

    return rows.filter((e) => {
      const hay = [
        e.vendor ?? "",
        e.job_name ?? "",
        e.description ?? "",
        isoDay(e.expense_date),
        isoDay(e.deleted_at),
        String(e.amount ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qq);
    });
  }, [rows, q]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const visibleIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);

  // IMPORTANT: only count selected that are visible
  const visibleSelectedCount = useMemo(() => {
    let n = 0;
    for (const id of selectedIds) if (visibleIds.has(id)) n++;
    return n;
  }, [selectedIds, visibleIds]);

  const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;

  function toggleAllVisible(on: boolean) {
    const next: Record<string, boolean> = { ...selected };
    if (on) {
      for (const r of filtered) next[r.id] = true;
    } else {
      for (const r of filtered) delete next[r.id];
    }
    setSelected(next);
  }

  async function restoreOne(id: string) {
    try {
      setBusyId(id);

      const { data, error } = await supabase.rpc("chiefos_restore_expense", {
        p_expense_id: id,
      });
      if (error) throw error;
      if (data !== true) throw new Error("Restore failed.");

      setRows((prev) => prev.filter((x) => x.id !== id));
      setSelected((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });

      toast.push({ kind: "success", message: "Expense restored." });
    } catch (e: any) {
      toast.push({ kind: "error", message: e?.message ?? "Restore failed." });
    } finally {
      setBusyId(null);
    }
  }

  function onRestoreSelectedClick() {
    const ids = selectedIds.filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;
    setConfirmOpen(true);
  }

  async function doRestoreSelected() {
    const ids = selectedIds.filter((id) => visibleIds.has(id));
    if (ids.length === 0) return;

    try {
      setBulkBusy(true);

      const { data, error } = await supabase.rpc("chiefos_restore_expenses_bulk", {
        p_expense_ids: ids,
      });
      if (error) throw error;

      setRows((prev) => prev.filter((x) => !ids.includes(x.id)));
      setSelected((prev) => {
        const n = { ...prev };
        for (const id of ids) delete n[id];
        return n;
      });

      const restoredCount = typeof data === "number" ? data : ids.length;
      toast.push({ kind: "success", message: `Restored ${restoredCount} expenses.` });
    } catch (e: any) {
      toast.push({ kind: "error", message: e?.message ?? "Bulk restore failed." });
    } finally {
      setBulkBusy(false);
    }
  }

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading trash…</div>;

  const totalSum = filtered.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Expenses</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Trash</h1>
            <p className="mt-1 text-sm text-white/60">
              Soft-deleted expenses. Restore individually or in bulk.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Visible</span>
              <span className="text-white">{filtered.length}</span>
            </div>
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Total</span>
              <span className="text-white">{money(totalSum)}</span>
            </div>

            <button
              onClick={() => router.push("/app/expenses")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Back
            </button>

            <button
              onClick={() => router.push("/app/expenses/audit")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Audit
            </button>

            <button
              onClick={() => router.push("/app/expenses/vendors")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Vendors
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs text-white/60 mb-1">Search trash</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                placeholder="Vendor, job, date, amount…"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => toggleAllVisible(!allVisibleSelected)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                disabled={filtered.length === 0 || bulkBusy}
              >
                {allVisibleSelected ? "Clear selection" : "Select all (visible)"}
              </button>

              <div className={chip("border-white/10 bg-black/40 text-white/70")}>
                <span className="text-white/45">Selected</span>
                <span className="text-white">{visibleSelectedCount}</span>
              </div>

              <button
                onClick={onRestoreSelectedClick}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                disabled={visibleSelectedCount === 0 || bulkBusy}
              >
                {bulkBusy ? "Restoring…" : `Restore selected (${visibleSelectedCount})`}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Trash is empty.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                    />
                  </th>
                  <th className="py-3 pr-4">Deleted</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Job</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4">Restore</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="py-3 pl-4 pr-4">
                      <input
                        type="checkbox"
                        checked={!!selected[e.id]}
                        onChange={(ev) =>
                          setSelected((prev) => ({ ...prev, [e.id]: ev.target.checked }))
                        }
                      />
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/70">
                      {isoDay(e.deleted_at)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/70">
                      {isoDay(e.expense_date)}
                    </td>
                    <td className="py-3 pr-4 text-white/85">{e.vendor ?? "—"}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/85">
                      {money(e.amount)}
                    </td>
                    <td className="py-3 pr-4 text-white/70">{e.job_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-white/70">{e.description ?? ""}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => restoreOne(e.id)}
                        disabled={busyId === e.id || bulkBusy}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                      >
                        {busyId === e.id ? "Restoring…" : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Confirm modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0B0E] p-4">
              <div className="text-sm font-semibold text-white/90">Confirm</div>
              <div className="mt-2 text-sm text-white/70">
                Restore {visibleSelectedCount} expenses?
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                  onClick={() => setConfirmOpen(false)}
                  disabled={bulkBusy}
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                  onClick={async () => {
                    setConfirmOpen(false);
                    await doRestoreSelected();
                  }}
                  disabled={bulkBusy}
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
