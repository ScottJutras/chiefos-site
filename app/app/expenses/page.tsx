"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Expense = {
  id: string;
  amount: number;
  vendor: string | null;
  description: string | null;
  expense_date: string; // ISO date
  job_name: string | null;
};

type EditDraft = {
  id: string;
  amount: string;
  vendor: string;
  description: string;
  expense_date: string; // yyyy-mm-dd
  job_name: string;
};

type GroupBy =
  | "none"
  | "vendor"
  | "job"
  | "year"
  | "month"
  | "date"
  | "amount_bucket";

type SortBy = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "vendor_asc" | "vendor_desc";

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function safeLower(v: any) {
  return String(v ?? "").toLowerCase();
}

function monthKey(iso: string) {
  const d = isoDay(iso);
  return d ? d.slice(0, 7) : ""; // YYYY-MM
}

function yearKey(iso: string) {
  const d = isoDay(iso);
  return d ? d.slice(0, 4) : "";
}

function toMoney(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function amountBucket(amount: number) {
  // Simple + useful buckets for duplicate detection / scanning
  if (amount < 10) return "< $10";
  if (amount < 25) return "$10–$24.99";
  if (amount < 50) return "$25–$49.99";
  if (amount < 100) return "$50–$99.99";
  if (amount < 250) return "$100–$249.99";
  if (amount < 500) return "$250–$499.99";
  if (amount < 1000) return "$500–$999.99";
  return "≥ $1000";
}

export default function ExpensesPage() {
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [saving, setSaving] = useState(false);
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

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        if (!auth.user) {
          router.push("/login");
          return;
        }

        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (puErr) throw puErr;

        if (!pu?.tenant_id) {
          router.push("/finish-signup");
          return;
        }

        const { data: mapRows, error: mapErr } = await supabase
          .from("chiefos_identity_map")
          .select("id")
          .eq("tenant_id", pu.tenant_id)
          .eq("kind", "whatsapp")
          .limit(1);

        if (mapErr) throw mapErr;

        if (!mapRows || mapRows.length === 0) {
          router.push("/app/connect-whatsapp");
          return;
        }

        const { data, error } = await supabase
          .from("chiefos_expenses")
          .select("*")
          .order("expense_date", { ascending: false });

        if (error) throw error;

        if (!cancelled) setExpenses((data ?? []) as Expense[]);
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
  }, [router]);

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

  // Duplicate detection: key = date + vendor + amount
  const dupeKeyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const k = `${isoDay(e.expense_date)}|${String(e.vendor || "").trim().toLowerCase()}|${toMoney(e.amount).toFixed(2)}`;
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
          const k = `${isoDay(e.expense_date)}|${String(e.vendor || "").trim().toLowerCase()}|${toMoney(e.amount).toFixed(2)}`;
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

    // Sort groups (most useful defaults)
    if (groupBy === "month" || groupBy === "year" || groupBy === "date") {
      groups.sort((a, b) => String(b.key).localeCompare(String(a.key))); // newest first
    } else {
      groups.sort((a, b) => b.sum - a.sum); // biggest spend first
    }

    return groups;
  }, [sorted, groupBy]);

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
    ws["!cols"] = [
      { wch: 4 },
      { wch: 14 },
      { wch: 24 },
      { wch: 12 },
      { wch: 22 },
      { wch: 40 },
    ];

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
    const list = sorted; // ✅ export filtered+sorted (not raw)
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
    if (!Number.isFinite(amt) || amt < 0) {
      alert("Amount must be a valid number.");
      return;
    }
    if (!draft.expense_date) {
      alert("Expense date is required.");
      return;
    }

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

  async function copyGroupSummary() {
    if (!grouped) return;

    const lines = [
      ["Group", "Count", "Total"].join(","),
      ...grouped.map((g) => `"${String(g.key).replace(/"/g, '""')}",${g.count},"${g.sum.toFixed(2)}"`),
      `,"Grand Count",${totals.count}`,
      `,"Grand Total","${totals.sum.toFixed(2)}"`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      alert("Copied group summary to clipboard.");
    } catch {
      alert("Could not copy to clipboard (browser blocked).");
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
  }

  if (loading) return <div className="p-8 text-gray-600">Loading expenses…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Expenses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Filter, group, detect duplicates, edit, and export.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => runDownload("csv")}
              disabled={!sorted.length || downloading !== null}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading === "csv" ? "Preparing…" : "Download CSV"}
            </button>

            <button
              onClick={() => runDownload("xlsx")}
              disabled={!sorted.length || downloading !== null}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading === "xlsx" ? "Preparing…" : "Download Excel"}
            </button>

            <button
              onClick={() => runDownload("pdf")}
              disabled={!sorted.length || downloading !== null}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading === "pdf" ? "Preparing…" : "Download PDF"}
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 rounded-lg border p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Vendor, job, description, amount…"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Vendor</label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
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
              <label className="block text-xs text-gray-600 mb-1">Job</label>
              <select
                value={job}
                onChange={(e) => setJob(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
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
              <label className="block text-xs text-gray-600 mb-1">Group by</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
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
              <label className="block text-xs text-gray-600 mb-1">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
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
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Min $</label>
                <input
                  value={minAmt}
                  onChange={(e) => setMinAmt(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Max $</label>
                <input
                  value={maxAmt}
                  onChange={(e) => setMaxAmt(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="1000"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyDupes}
                  onChange={(e) => setOnlyDupes(e.target.checked)}
                />
                Show duplicates (same date + vendor + amount)
              </label>

              <button
                onClick={resetAll}
                className="ml-auto rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-gray-600 flex-wrap gap-2">
            <div>
              Showing <span className="font-medium text-gray-900">{totals.count}</span> filtered items • Total{" "}
              <span className="font-medium text-gray-900">${totals.sum.toFixed(2)}</span>
            </div>

            {groupBy !== "none" && grouped && (
              <button
                onClick={copyGroupSummary}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Copy group summary
              </button>
            )}
          </div>
        </div>

        {/* Grouped view */}
        {groupBy !== "none" && grouped ? (
          <div className="mt-8 space-y-4">
            {grouped.map((g) => (
              <div key={g.key} className="rounded-lg border">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-semibold">{g.key}</span>{" "}
                    <span className="text-gray-500">({g.count} items)</span>
                  </div>
                  <div className="text-sm font-semibold">${g.sum.toFixed(2)}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-600">
                        <th className="py-2 px-4 w-10">#</th>
                        <th className="py-2 px-4">Date</th>
                        <th className="py-2 px-4">Vendor</th>
                        <th className="py-2 px-4">Amount</th>
                        <th className="py-2 px-4">Job</th>
                        <th className="py-2 px-4">Description</th>
                        <th className="py-2 px-4 w-20">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((e, ix) => (
                        <tr key={e.id} className="border-b text-sm">
                          <td className="py-2 px-4 text-gray-500">{ix + 1}</td>
                          <td className="py-2 px-4 whitespace-nowrap">{isoDay(e.expense_date)}</td>
                          <td className="py-2 px-4">{e.vendor ?? "—"}</td>
                          <td className="py-2 px-4 whitespace-nowrap">${toMoney(e.amount).toFixed(2)}</td>
                          <td className="py-2 px-4">{e.job_name ?? "—"}</td>
                          <td className="py-2 px-4">{e.description ?? ""}</td>
                          <td className="py-2 px-4">
                            <button
                              onClick={() => openEdit(e)}
                              className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-3 px-4 text-xs text-gray-500" colSpan={3}>
                          Group total
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold">
                          ${g.sum.toFixed(2)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="rounded-lg border p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">Grand total (filtered)</div>
              <div className="text-lg font-bold">${totals.sum.toFixed(2)}</div>
            </div>
          </div>
        ) : (
          // Flat list view
          sorted.length === 0 ? (
            <p className="mt-12 text-gray-600">No expenses match your filters.</p>
          ) : (
            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-600">
                    <th className="py-2 pr-4 w-10">#</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Job</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 w-24">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e, ix) => (
                    <tr key={e.id} className="border-b text-sm">
                      <td className="py-2 pr-4 text-gray-500">{ix + 1}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{isoDay(e.expense_date)}</td>
                      <td className="py-2 pr-4">{e.vendor ?? "—"}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">${toMoney(e.amount).toFixed(2)}</td>
                      <td className="py-2 pr-4">{e.job_name ?? "—"}</td>
                      <td className="py-2 pr-4">{e.description ?? ""}</td>
                      <td className="py-2">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-3 pr-4 text-xs text-gray-500" colSpan={3}>
                      Total (filtered)
                    </td>
                    <td className="py-3 pr-4 text-sm font-semibold">
                      ${totals.sum.toFixed(2)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Edit Modal */}
        {editOpen && draft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-lg border">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Edit expense</h2>
                  <p className="text-xs text-gray-500">Saved via tenant-scoped RPC.</p>
                </div>
                <button
                  onClick={closeEdit}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={draft.expense_date}
                    onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Amount</label>
                  <input
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="18.50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Vendor</label>
                  <input
                    value={draft.vendor}
                    onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Home Depot"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Job</label>
                  <input
                    value={draft.job_name}
                    onChange={(e) => setDraft({ ...draft, job_name: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Medway Park"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    rows={3}
                    placeholder="What was this for?"
                  />
                </div>
              </div>

              <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
                <button
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
