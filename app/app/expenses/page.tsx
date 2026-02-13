// app/app/expenses/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTenantGate } from "@/lib/useTenantGate";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Slideover from "@/app/app/components/Slideover";



type Expense = {
  id: string;
  amount: number;
  vendor: string | null;
  description: string | null;
  expense_date: string;
  job_name: string | null;
  deleted_at?: string | null;
};

type EditDraft = {
  id: string;
  amount: string;
  vendor: string;
  description: string;
  expense_date: string;
  job_name: string;
};

type GroupBy = "none" | "vendor" | "job" | "year" | "month" | "date" | "amount_bucket";

type SortBy =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "vendor_asc"
  | "vendor_desc";

type SavedView = {
  id: string;
  name: string;
  payload: any;
  updated_at: string;
};

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function toMoney(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function monthKey(iso: string) {
  const d = isoDay(iso);
  return d ? d.slice(0, 7) : "";
}

function yearKey(iso: string) {
  const d = isoDay(iso);
  return d ? d.slice(0, 4) : "";
}

function amountBucket(amount: number) {
  if (amount < 10) return "< $10";
  if (amount < 25) return "$10–$24.99";
  if (amount < 50) return "$25–$49.99";
  if (amount < 100) return "$50–$99.99";
  if (amount < 250) return "$100–$249.99";
  if (amount < 500) return "$250–$499.99";
  if (amount < 1000) return "$500–$999.99";
  return "≥ $1000";
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

export default function ExpensesPage() {
  const router = useRouter();
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: true });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [job, setJob] = useState<string>("all");
  const [vendor, setVendor] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [minAmt, setMinAmt] = useState<string>("");
  const [maxAmt, setMaxAmt] = useState<string>("");
  const [onlyDupes, setOnlyDupes] = useState(false);

  // View controls
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");

  // More menu
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  // Undo bar state
  const [undo, setUndo] = useState<{
    batchId: string;
    expiresAt: string;
    deletedCount: number;
  } | null>(null);
  const undoTimerRef = useRef<any>(null);

  // Saved views
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!moreRef.current) return;
      if (e.target instanceof Node && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("chiefos_expenses")
          .select("*")
          .is("deleted_at", null)
          .order("expense_date", { ascending: false });

        if (error) throw error;
        if (!cancelled) setExpenses((data ?? []) as Expense[]);

        const { data: vData, error: vErr } = await supabase.rpc("chiefos_list_saved_views");
        if (!vErr && !cancelled) setViews((vData ?? []) as SavedView[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load expenses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const jobs = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) {
      const j = String(e.job_name || "").trim();
      if (j) set.add(j);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) {
      const v = String(e.vendor || "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  // Duplicate detection (same date + vendor + amount)
  const dupeKeyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const k = `${isoDay(e.expense_date)}|${String(e.vendor || "").trim().toLowerCase()}|${toMoney(
        e.amount
      ).toFixed(2)}`;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [expenses]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const min = minAmt.trim() ? Number(minAmt) : null;
    const max = maxAmt.trim() ? Number(maxAmt) : null;

    return expenses
      .filter((e) => {
        const day = isoDay(e.expense_date);
        if (fromDate && day && day < fromDate) return false;
        if (toDate && day && day > toDate) return false;

        const ej = String(e.job_name || "").trim();
        if (job !== "all" && ej !== job) return false;

        const ev = String(e.vendor || "").trim();
        if (vendor !== "all" && ev !== vendor) return false;

        const amt = toMoney(e.amount);
        if (min != null && Number.isFinite(min) && amt < min) return false;
        if (max != null && Number.isFinite(max) && amt > max) return false;

        if (onlyDupes) {
          const k = `${isoDay(e.expense_date)}|${String(e.vendor || "")
            .trim()
            .toLowerCase()}|${toMoney(e.amount).toFixed(2)}`;
          if ((dupeKeyCounts.get(k) || 0) < 2) return false;
        }

        if (!qq) return true;

        const hay = [
          e.vendor ?? "",
          e.description ?? "",
          e.job_name ?? "",
          isoDay(e.expense_date),
          String(e.amount ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(qq);
      })
      .slice();
  }, [expenses, q, job, vendor, fromDate, toDate, minAmt, maxAmt, onlyDupes, dupeKeyCounts]);

  const sorted = useMemo(() => {
    const out = filtered.slice();
    const cmpStr = (a: string, b: string) => a.localeCompare(b);
    const cmpNum = (a: number, b: number) => a - b;

    out.sort((A, B) => {
      const aDate = isoDay(A.expense_date);
      const bDate = isoDay(B.expense_date);
      const aAmt = toMoney(A.amount);
      const bAmt = toMoney(B.amount);
      const aVend = String(A.vendor || "").trim();
      const bVend = String(B.vendor || "").trim();

      switch (sortBy) {
        case "date_asc":
          return cmpStr(aDate, bDate);
        case "date_desc":
          return cmpStr(bDate, aDate);
        case "amount_asc":
          return cmpNum(aAmt, bAmt);
        case "amount_desc":
          return cmpNum(bAmt, aAmt);
        case "vendor_asc":
          return cmpStr(aVend, bVend);
        case "vendor_desc":
          return cmpStr(bVend, aVend);
        default:
          return 0;
      }
    });

    return out;
  }, [filtered, sortBy]);

  const totals = useMemo(() => {
    const count = sorted.length;
    const sum = sorted.reduce((acc, e) => acc + toMoney(e.amount), 0);
    return { count, sum };
  }, [sorted]);

  // Grouping (kept for later UI expansion)
  const grouped = useMemo(() => {
    if (groupBy === "none") return null;

    const m = new Map<string, Expense[]>();
    const keyOf = (e: Expense) => {
      if (groupBy === "vendor") return String(e.vendor || "—").trim() || "—";
      if (groupBy === "job") return String(e.job_name || "—").trim() || "—";
      if (groupBy === "year") return yearKey(e.expense_date) || "—";
      if (groupBy === "month") return monthKey(e.expense_date) || "—";
      if (groupBy === "date") return isoDay(e.expense_date) || "—";
      if (groupBy === "amount_bucket") return amountBucket(toMoney(e.amount));
      return "—";
    };

    for (const e of sorted) {
      const k = keyOf(e);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }

    const groups = Array.from(m.entries()).map(([key, items]) => {
      const sum = items.reduce((acc, x) => acc + toMoney(x.amount), 0);
      return { key, items, sum, count: items.length };
    });

    if (groupBy === "month" || groupBy === "year" || groupBy === "date") {
      groups.sort((a, b) => String(b.key).localeCompare(String(a.key)));
    } else {
      groups.sort((a, b) => b.sum - a.sum);
    }
    return groups;
  }, [sorted, groupBy]);

  // Keep selection sane if filters change
  useEffect(() => {
    const visible = new Set(sorted.map((e) => e.id));
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v && visible.has(k)) next[k] = true;
      }
      return next;
    });
  }, [sorted]);

  function buildRows(list: Expense[]) {
    const headers = ["#", "Date", "Vendor", "Amount", "Job", "Description"];
    const rows = list.map((e, ix) => [
      ix + 1,
      isoDay(e.expense_date),
      e.vendor ?? "",
      Number(toMoney(e.amount)),
      e.job_name ?? "",
      e.description ?? "",
    ]);
    return { headers, rows };
  }

  function downloadCSV(list: Expense[]) {
    if (!list.length) return;
    const { headers, rows } = buildRows(list);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  function downloadXLSX(list: Expense[]) {
    if (!list.length) return;
    const { headers, rows } = buildRows(list);
    const data = [headers, ...rows];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, "expenses.xlsx");
  }

  function downloadPDF(list: Expense[]) {
    if (!list.length) return;

    const { headers, rows } = buildRows(list);
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    doc.setFontSize(14);
    doc.text("Expenses", 40, 40);

    autoTable(doc, {
      startY: 60,
      head: [headers],
      body: rows.map((r) => {
        const rr = [...r];
        const amt = Number(rr[3] || 0);
        rr[3] = `$${amt.toFixed(2)}`;
        return rr;
      }),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 70 },
        2: { cellWidth: 120 },
        3: { halign: "right", cellWidth: 70 },
      },
    });

    doc.save("expenses.pdf");
  }

  async function runDownload(kind: "csv" | "xlsx" | "pdf") {
    const list = sorted;
    if (!list.length || downloading) return;
    try {
      setDownloading(kind);
      if (kind === "csv") downloadCSV(list);
      if (kind === "xlsx") downloadXLSX(list);
      if (kind === "pdf") downloadPDF(list);
    } finally {
      setDownloading(null);
    }
  }

  function openEdit(e: Expense) {
    setDraft({
      id: e.id,
      amount: String(e.amount ?? ""),
      vendor: e.vendor ?? "",
      description: e.description ?? "",
      expense_date: isoDay(e.expense_date) || "",
      job_name: e.job_name ?? "",
    });
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setDraft(null);
  }

  async function saveEdit() {
    if (!draft) return;

    const amt = Number(String(draft.amount || "").replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(amt) || amt < 0) return alert("Amount must be a valid number.");
    if (!draft.expense_date) return alert("Expense date is required.");

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc("chiefos_update_expense", {
        p_expense_id: draft.id,
        p_amount: amt,
        p_vendor: draft.vendor?.trim() || null,
        p_description: draft.description?.trim() || null,
        p_expense_date: draft.expense_date,
        p_job_name: draft.job_name?.trim() || null,
      });

      if (error) throw error;

      const updated = data as Expense;
      setExpenses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      closeEdit();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  }

  function resetAll() {
    setQ("");
    setJob("all");
    setVendor("all");
    setFromDate("");
    setToDate("");
    setMinAmt("");
    setMaxAmt("");
    setOnlyDupes(false);
    setGroupBy("none");
    setSortBy("date_desc");
    setSelected({});
  }

  function toggleAllVisible(on: boolean) {
    const next: Record<string, boolean> = {};
    if (on) for (const e of sorted) next[e.id] = true;
    setSelected(next);
  }

  async function bulkAssignJob(newJob: string) {
    const ids = selectedIds;
    if (!ids.length) return;

    const j = String(newJob || "").trim();
    if (!j) return alert("Job name required.");

    try {
      setBulkBusy(true);
      const { data, error } = await supabase.rpc("chiefos_bulk_assign_expense_job", {
        p_expense_ids: ids,
        p_job_name: j,
      });
      if (error) throw error;

      setExpenses((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, job_name: j } : e)));
      setSelected({});
      alert(`Assigned job to ${data?.[0]?.updated_count ?? 0} expenses.`);
    } catch (e: any) {
      alert(e?.message ?? "Bulk assign failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  function clearUndoTimer() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  }

  function armUndoExpiry(expiresAtIso: string) {
    clearUndoTimer();
    const ms = Math.max(0, new Date(expiresAtIso).getTime() - Date.now());
    undoTimerRef.current = setTimeout(() => setUndo(null), ms + 250);
  }

  async function bulkDeleteSelected() {
    const ids = selectedIds;
    if (!ids.length) return;

    if (!confirm(`Soft-delete ${ids.length} expenses? You’ll have 10 minutes to undo.`)) return;

    try {
      setBulkBusy(true);
      const { data, error } = await supabase.rpc("chiefos_delete_expenses", {
        p_expense_ids: ids,
        p_undo_minutes: 10,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const batchId = row?.batch_id as string;
      const deletedCount = Number(row?.deleted_count ?? 0);
      const expiresAt = row?.expires_at as string;

      setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));
      setSelected({});

      if (batchId && expiresAt) {
        setUndo({ batchId, expiresAt, deletedCount });
        armUndoExpiry(expiresAt);
      } else {
        alert("Deleted (no undo batch returned).");
      }
    } catch (e: any) {
      alert(e?.message ?? "Delete failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function undoDelete() {
    if (!undo) return;
    try {
      setBulkBusy(true);
      const { data, error } = await supabase.rpc("chiefos_undo_delete_expenses", {
        p_batch_id: undo.batchId,
      });
      if (error) throw error;

      const { data: fresh, error: fErr } = await supabase
        .from("chiefos_expenses")
        .select("*")
        .is("deleted_at", null)
        .order("expense_date", { ascending: false });

      if (!fErr) setExpenses((fresh ?? []) as Expense[]);

      setUndo(null);
      clearUndoTimer();
      alert(`Restored ${data?.[0]?.restored_count ?? 0} expenses.`);
    } catch (e: any) {
      alert(e?.message ?? "Undo failed (maybe expired).");
    } finally {
      setBulkBusy(false);
    }
  }

  function currentViewPayload() {
    return { q, job, vendor, fromDate, toDate, minAmt, maxAmt, onlyDupes, groupBy, sortBy };
  }

  async function refreshViews() {
    const { data, error } = await supabase.rpc("chiefos_list_saved_views");
    if (!error) setViews((data ?? []) as SavedView[]);
  }

  async function saveView() {
    const name = String(viewName || "").trim();
    if (!name) return alert("View name required.");

    const payload = currentViewPayload();
    const { error } = await supabase.rpc("chiefos_upsert_saved_view", {
      p_name: name,
      p_payload: payload,
    });

    if (error) return alert(error.message);
    setViewName("");
    await refreshViews();
    alert("Saved view.");
  }

  function applyView(v: SavedView) {
    const p = v.payload || {};
    setQ(p.q ?? "");
    setJob(p.job ?? "all");
    setVendor(p.vendor ?? "all");
    setFromDate(p.fromDate ?? "");
    setToDate(p.toDate ?? "");
    setMinAmt(p.minAmt ?? "");
    setMaxAmt(p.maxAmt ?? "");
    setOnlyDupes(!!p.onlyDupes);
    setGroupBy(p.groupBy ?? "none");
    setSortBy(p.sortBy ?? "date_desc");
  }

  async function deleteView(id: string) {
    if (!confirm("Delete this saved view?")) return;
    const { error } = await supabase.rpc("chiefos_delete_saved_view", { p_view_id: id });
    if (error) return alert(error.message);
    await refreshViews();
  }

  if (gateLoading || loading) {
    return <div className="p-8 text-white/70">Loading expenses…</div>;
  }
  if (error) {
    return <div className="p-8 text-red-300">Error: {error}</div>;
  }

  const allVisibleSelected = sorted.length > 0 && selectedIds.length === sorted.length;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Ledger</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Expenses</h1>
            <p className="mt-1 text-sm text-white/60">
              Bulk actions • Undo delete • Saved views • Exports • Edit
            </p>
          </div>

          {/* More menu */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
            >
              More ▾
            </button>

            {moreOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden z-20">
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/app/expenses/audit");
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Audit
                </button>

                <button
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/app/expenses/trash");
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Trash
                </button>

                <button
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/app/expenses/vendors");
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Vendor normalization
                </button>

                <div className="border-t border-white/10" />

                <button
                  onClick={() => {
                    setMoreOpen(false);
                    runDownload("csv");
                  }}
                  disabled={!sorted.length || downloading !== null}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                >
                  {downloading === "csv" ? "Preparing…" : "Download CSV"}
                </button>

                <button
                  onClick={() => {
                    setMoreOpen(false);
                    runDownload("xlsx");
                  }}
                  disabled={!sorted.length || downloading !== null}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                >
                  {downloading === "xlsx" ? "Preparing…" : "Download Excel"}
                </button>

                <button
                  onClick={() => {
                    setMoreOpen(false);
                    runDownload("pdf");
                  }}
                  disabled={!sorted.length || downloading !== null}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                >
                  {downloading === "pdf" ? "Preparing…" : "Download PDF"}
                </button>

                <div className="border-t border-white/10" />

                <button
                  onClick={async () => {
                    setMoreOpen(false);
                    await supabase.auth.signOut();
                    router.push("/login");
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Undo bar */}
        {undo && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-white/80">
              Soft-deleted <b className="text-white">{undo.deletedCount}</b> expenses. Undo until{" "}
              <b className="text-white">{new Date(undo.expiresAt).toLocaleTimeString()}</b>.
            </div>
            <div className="flex gap-2">
              <button
                onClick={undoDelete}
                disabled={bulkBusy}
                className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
              >
                Undo delete
              </button>
              <button
                onClick={() => setUndo(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Saved views */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-white/90">Saved views</div>

            <input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Name this view (e.g., 'Home Depot - 2026 YTD')"
              className="flex-1 min-w-[240px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
            />

            <button
              onClick={saveView}
              className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
            >
              Save view
            </button>

            <button
              onClick={resetAll}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
            >
              Reset
            </button>
          </div>

          {views.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {views.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1"
                >
                  <button
                    onClick={() => applyView(v)}
                    className="text-sm text-white/80 hover:text-white hover:underline"
                    title="Apply this view"
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => deleteView(v.id)}
                    className="text-xs text-white/40 hover:text-red-300"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters + bulk actions */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-white/60 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Vendor, job, description, amount…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Vendor</label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
              >
                <option value="all">All vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Job</label>
              <select
                value={job}
                onChange={(e) => setJob(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
              >
                <option value="all">All jobs</option>
                {jobs.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Group by</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
              >
                <option value="none">None</option>
                <option value="vendor">Vendor</option>
                <option value="job">Job</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="date">Exact date</option>
                <option value="amount_bucket">Amount bucket</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
              >
                <option value="date_desc">Date (newest)</option>
                <option value="date_asc">Date (oldest)</option>
                <option value="amount_desc">Amount (high → low)</option>
                <option value="amount_asc">Amount (low → high)</option>
                <option value="vendor_asc">Vendor (A → Z)</option>
                <option value="vendor_desc">Vendor (Z → A)</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-white/60 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-white/60 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-white/60 mb-1">Min $</label>
                <input
                  value={minAmt}
                  onChange={(e) => setMinAmt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-white/60 mb-1">Max $</label>
                <input
                  value={maxAmt}
                  onChange={(e) => setMaxAmt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                  placeholder="1000"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={onlyDupes}
                  onChange={(e) => setOnlyDupes(e.target.checked)}
                />
                Show duplicates
              </label>

              <div className="ml-auto text-sm text-white/70">
                {totals.count} items • <b className="text-white">${totals.sum.toFixed(2)}</b>
              </div>
            </div>
          </div>

          {/* Bulk bar */}
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAllVisible(!allVisibleSelected)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                {allVisibleSelected ? "Clear selection" : "Select all (visible)"}
              </button>
              <div className="text-sm text-white/70">
                Selected: <b className="text-white">{selectedIds.length}</b>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                id="bulkJob"
                placeholder="Assign job to selected…"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15 w-56"
                disabled={bulkBusy || selectedIds.length === 0}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value;
                    await bulkAssignJob(v);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <button
                onClick={async () => {
                  const el = document.getElementById("bulkJob") as HTMLInputElement | null;
                  const v = el?.value || "";
                  await bulkAssignJob(v);
                  if (el) el.value = "";
                }}
                disabled={bulkBusy || selectedIds.length === 0}
                className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
              >
                Assign job
              </button>

              <button
                onClick={bulkDeleteSelected}
                disabled={bulkBusy || selectedIds.length === 0}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
              >
                Delete (undoable)
              </button>
            </div>
          </div>
        </div>

        {/* Ledger table */}
        {sorted.length === 0 ? (
          <p className="mt-12 text-white/60">No expenses match your filters.</p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                    />
                  </th>
                  <th className="py-3 pr-4 w-10">#</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Job</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4 w-24">Edit</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, ix) => {
                  const checked = !!selected[e.id];
                  const k = `${isoDay(e.expense_date)}|${String(e.vendor || "")
                    .trim()
                    .toLowerCase()}|${toMoney(e.amount).toFixed(2)}`;
                  const isDupe = (dupeKeyCounts.get(k) || 0) >= 2;

                  return (
                    <tr key={e.id} className="border-b border-white/5 text-sm">
                      <td className="py-3 pl-4 pr-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(ev) =>
                            setSelected((prev) => ({ ...prev, [e.id]: ev.target.checked }))
                          }
                        />
                      </td>
                      <td className="py-3 pr-4 text-white/45">{ix + 1}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/85">
                        {isoDay(e.expense_date)}
                      </td>
                      <td className="py-3 pr-4 text-white/85">
                        {e.vendor ?? "—"}{" "}
                        {isDupe && <span className="ml-2 text-xs text-orange-300">(dupe?)</span>}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white">
                        ${toMoney(e.amount).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 text-white/85">{e.job_name ?? "—"}</td>
                      <td className="py-3 pr-4 text-white/75">{e.description ?? ""}</td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}

                <tr>
                  <td className="py-3 pl-4 pr-4 text-xs text-white/45" colSpan={4}>
                    Total (filtered)
                  </td>
                  <td className="py-3 pr-4 text-sm font-semibold text-white">
                    ${totals.sum.toFixed(2)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Edit modal */}
        <Slideover
  open={editOpen && !!draft}
  onClose={closeEdit}
  title="Edit expense"
  subtitle="Tenant-scoped update via RPC"
  footer={
    <div className="flex justify-end gap-2">
      <button
        onClick={closeEdit}
        disabled={saving}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={saveEdit}
        disabled={saving}
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  }
>
  {draft && (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="block text-xs text-white/60 mb-1">Date</label>
        <input
          type="date"
          value={draft.expense_date}
          onChange={(e) =>
            setDraft({ ...draft, expense_date: e.target.value })
          }
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
        />
      </div>

      <div>
        <label className="block text-xs text-white/60 mb-1">Amount</label>
        <input
          value={draft.amount}
          onChange={(e) =>
            setDraft({ ...draft, amount: e.target.value })
          }
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
          placeholder="18.50"
        />
      </div>

      <div>
        <label className="block text-xs text-white/60 mb-1">Vendor</label>
        <input
          value={draft.vendor}
          onChange={(e) =>
            setDraft({ ...draft, vendor: e.target.value })
          }
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
        />
      </div>

      <div>
        <label className="block text-xs text-white/60 mb-1">Job</label>
        <input
          value={draft.job_name}
          onChange={(e) =>
            setDraft({ ...draft, job_name: e.target.value })
          }
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
        />
      </div>

      <div>
        <label className="block text-xs text-white/60 mb-1">
          Description
        </label>
        <textarea
          value={draft.description}
          onChange={(e) =>
            setDraft({ ...draft, description: e.target.value })
          }
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
          rows={3}
        />
      </div>
    </div>
  )}
</Slideover>


        {/* Note on grouping (kept) */}
        {grouped && (
          <div className="mt-6 text-xs text-white/40">
            Grouping is computed. Next step: render grouped accordion + group totals in the ledger.
          </div>
        )}
      </div>
    </main>
  );
}
