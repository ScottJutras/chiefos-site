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

  // ✅ NEW: selection state
  const [selected, setSelected] = useState<Record<string, boolean>>({});

 useEffect(() => {
    document.title = "Trash · ChiefOS";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
  .from("chiefos_expenses")
  .select("*")
  .not("deleted_at", "is", null)
  .order("deleted_at", { ascending: false });

if (!cancelled) {
  if (error) {
    console.warn(error.message);
    setRows([]);
  } else {
    setRows((data ?? []) as Expense[]);
  }
  setLoading(false);
}

    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

  const allVisibleSelected =
    filtered.length > 0 && selectedIds.length === filtered.length;

  function toggleAllVisible(on: boolean) {
    const next: Record<string, boolean> = {};
    if (on) for (const r of filtered) next[r.id] = true;
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
  if (selectedIds.length === 0) return;
  setConfirmOpen(true);
}

async function doRestoreSelected() {
  if (selectedIds.length === 0) return;

  try {
    setBulkBusy(true);

    const { data, error } = await supabase.rpc("chiefos_restore_expenses_bulk", {
      p_expense_ids: selectedIds,
    });
    if (error) throw error;

    setRows((prev) => prev.filter((x) => !selectedIds.includes(x.id)));
    setSelected({});

    const restoredCount = typeof data === "number" ? data : selectedIds.length;
    toast.push({ kind: "success", message: `Restored ${restoredCount} expenses.` });
  } catch (e: any) {
    toast.push({ kind: "error", message: e?.message ?? "Bulk restore failed." });
  } finally {
    setBulkBusy(false);
  }
}


    if (gateLoading || loading) return <div className="p-8 text-gray-600">Loading trash…</div>;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Trash</h1>
            <p className="mt-1 text-sm text-gray-500">
              Soft-deleted expenses. Restore individually or in bulk.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push("/app/expenses")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to Expenses
            </button>
            <button
              onClick={() => router.push("/app/expenses/audit")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Audit
            </button>
            <button
              onClick={() => router.push("/app/expenses/vendors")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Vendors
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-lg border p-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs text-gray-600 mb-1">Search trash</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Vendor, job, date, amount…"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAllVisible(!allVisibleSelected)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                disabled={filtered.length === 0 || bulkBusy}
              >
                {allVisibleSelected ? "Clear selection" : "Select all (visible)"}
              </button>

              <button
                onClick={onRestoreSelectedClick}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={selectedIds.length === 0 || bulkBusy}
              >
                {bulkBusy ? "Restoring…" : `Restore selected (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 text-gray-600">Trash is empty.</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-left text-sm text-gray-600">
                  <th className="py-2 pr-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                    />
                  </th>
                  <th className="py-2 pr-4">Deleted</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2">Restore</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b text-sm">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={!!selected[e.id]}
                        onChange={(ev) =>
                          setSelected((prev) => ({ ...prev, [e.id]: ev.target.checked }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{isoDay(e.deleted_at)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{isoDay(e.expense_date)}</td>
                    <td className="py-2 pr-4">{e.vendor ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">${Number(e.amount).toFixed(2)}</td>
                    <td className="py-2 pr-4">{e.job_name ?? "—"}</td>
                    <td className="py-2 pr-4">{e.description ?? ""}</td>
                    <td className="py-2">
                      <button
                        onClick={() => restoreOne(e.id)}
                        disabled={busyId === e.id || bulkBusy}
                        className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
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

        {confirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-lg bg-white border p-4">
              <div className="text-sm font-semibold">Confirm</div>
              <div className="mt-2 text-sm text-gray-700">
                Restore {selectedIds.length} expenses?
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setConfirmOpen(false)}
                  disabled={bulkBusy}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-black text-white px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
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

