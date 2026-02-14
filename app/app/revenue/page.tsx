// app/app/revenue/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RevenueRow = {
  id?: string;
  created_at?: string;
  occurred_on?: string;
  date?: string;

  amount?: number | string;
  total?: number | string;

  source?: string;
  client?: string;
  note?: string;
  memo?: string;

  job_name?: string;
  job_id?: string;
};

type SortBy =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "desc_asc"
  | "desc_desc"
  | "job_asc"
  | "job_desc";

type TotalsRange = "all" | "ytd" | "mtd" | "wtd" | "today";

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function toMoney(n: any) {
  const x = Number(String(n ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function pickDate(x: RevenueRow) {
  return isoDay(x.date || x.occurred_on || x.created_at || "") || "—";
}

function pickDesc(x: RevenueRow) {
  return (x.source || x.client || x.note || x.memo || "").trim() || "—";
}

function pickJob(x: RevenueRow) {
  return String(x.job_name || x.job_id || "").trim() || "—";
}

function stableKey(x: RevenueRow, ix: number) {
  const d = pickDate(x);
  const a = toMoney(x.amount ?? x.total);
  const j = pickJob(x);
  const s = pickDesc(x);
  return x.id || `${d}|${a.toFixed(2)}|${j}|${s}|${ix}`;
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

function moneyFmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function startOfWeekMondayLocal(d: Date) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() + diff);
  return out;
}

export default function RevenuePage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [job, setJob] = useState<string>("all");

  // View controls
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");
  const [totalsRange, setTotalsRange] = useState<TotalsRange>("all");

  // Export menu
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | "pdf" | null>(null);

  // Header sort helpers
  function sortArrow(active: boolean, dir: "asc" | "desc") {
    if (!active) return <span className="ml-1 text-white/30">↕</span>;
    return <span className="ml-1 text-white/80">{dir === "asc" ? "▲" : "▼"}</span>;
  }

  function toggleSort(field: "date" | "amount" | "desc" | "job") {
    setSortBy((prev) => {
      const asc: SortBy =
        field === "date"
          ? "date_asc"
          : field === "amount"
          ? "amount_asc"
          : field === "job"
          ? "job_asc"
          : "desc_asc";

      const desc: SortBy =
        field === "date"
          ? "date_desc"
          : field === "amount"
          ? "amount_desc"
          : field === "job"
          ? "job_desc"
          : "desc_desc";

      if (prev === desc) return asc;
      return desc;
    });
  }

  const TopChipButton = ({
    children,
    onClick,
    disabled,
    title,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition disabled:opacity-50"
    >
      {children}
    </button>
  );

  const RangePill = ({ id, label }: { id: TotalsRange; label: string }) => {
    const active = totalsRange === id;
    return (
      <button
        type="button"
        onClick={() => setTotalsRange(id)}
        className={[
          "rounded-full border px-3 py-1 text-xs transition",
          active
            ? "border-white/20 bg-white text-black"
            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  useEffect(() => {
    document.title = "Revenue · ChiefOS";
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!exportRef.current) return;
      if (e.target instanceof Node && !exportRef.current.contains(e.target))
        setExportOpen(false);
    }
    if (exportOpen) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  useEffect(() => {
    (async () => {
      if (gateLoading) return;
      if (!tenantId) return;

      setErr(null);
      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) throw new Error("Missing session token.");

        const r = await fetch(`/api/revenue/list?tenantId=${encodeURIComponent(tenantId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load revenue.");

        setRows((j.rows || []) as RevenueRow[]);
      } catch (e: any) {
        setErr(e?.message || "Failed to load revenue.");
      } finally {
        setLoading(false);
      }
    })();
  }, [gateLoading, tenantId]);

  const jobs = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const j = String(r.job_name || r.job_id || "").trim();
      if (j) set.add(j);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (rows || [])
      .filter((x) => {
        const j = pickJob(x);
        if (job !== "all" && j !== job) return false;

        if (!qq) return true;
        const hay = [pickDate(x), pickDesc(x), pickJob(x), String(x.amount ?? x.total ?? "")]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      })
      .slice();
  }, [rows, q, job]);

  const sorted = useMemo(() => {
    const out = filtered.slice();
    const cmpStr = (a: string, b: string) => String(a).localeCompare(String(b));

    out.sort((A, B) => {
      const aDate = pickDate(A);
      const bDate = pickDate(B);

      const aAmt = toMoney(A.amount ?? A.total);
      const bAmt = toMoney(B.amount ?? B.total);

      const aDesc = pickDesc(A);
      const bDesc = pickDesc(B);

      const aJob = pickJob(A);
      const bJob = pickJob(B);

      switch (sortBy) {
        case "date_asc":
          return cmpStr(aDate, bDate);
        case "date_desc":
          return cmpStr(bDate, aDate);

        case "amount_asc":
          return aAmt - bAmt;
        case "amount_desc":
          return bAmt - aAmt;

        case "desc_asc":
          return cmpStr(aDesc, bDesc);
        case "desc_desc":
          return cmpStr(bDesc, aDesc);

        case "job_asc":
          return cmpStr(aJob, bJob);
        case "job_desc":
          return cmpStr(bJob, aJob);

        default:
          return 0;
      }
    });

    return out;
  }, [filtered, sortBy]);

  const totalsList = useMemo(() => {
    if (totalsRange === "all") return sorted;

    const now = new Date();
    const todayIso = isoDay(now.toISOString());
    const startYTD = new Date(now.getFullYear(), 0, 1);
    const startMTD = new Date(now.getFullYear(), now.getMonth(), 1);
    const startWTD = startOfWeekMondayLocal(now);

    const startIso =
      totalsRange === "ytd"
        ? isoDay(startYTD.toISOString())
        : totalsRange === "mtd"
        ? isoDay(startMTD.toISOString())
        : totalsRange === "wtd"
        ? isoDay(startWTD.toISOString())
        : todayIso;

    return sorted.filter((e) => {
      const d = pickDate(e);
      if (!d || d === "—") return false;
      if (totalsRange === "today") return d === todayIso;
      return d >= startIso && d <= todayIso;
    });
  }, [sorted, totalsRange]);

  const totals = useMemo(() => {
    const count = totalsList.length;
    const sum = totalsList.reduce((acc, x) => acc + toMoney(x.amount ?? x.total), 0);
    return { count, sum };
  }, [totalsList]);

  function buildRows(list: RevenueRow[]) {
    const headers = ["#", "Date", "Amount", "Description", "Job"];
    const rowsOut = list.map((x, ix) => [
      ix + 1,
      pickDate(x),
      toMoney(x.amount ?? x.total),
      pickDesc(x),
      pickJob(x),
    ]);
    return { headers, rows: rowsOut };
  }

  function downloadCSV(list: RevenueRow[]) {
    if (!list.length) return;
    const { headers, rows: rr } = buildRows(list);
    const csv = [headers, ...rr]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenue.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadXLSX(list: RevenueRow[]) {
    if (!list.length) return;
    const { headers, rows: rr } = buildRows(list);
    const data = [headers, ...rr];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Revenue");
    XLSX.writeFile(wb, "revenue.xlsx");
  }

  function downloadPDF(list: RevenueRow[]) {
    if (!list.length) return;
    const { headers, rows: rr } = buildRows(list);

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    doc.setFontSize(14);
    doc.text("Revenue", 40, 40);

    autoTable(doc, {
      startY: 60,
      head: [headers],
      body: rr.map((r) => {
        const x = [...r];
        const amt = Number(x[2] || 0);
        x[2] = `$${amt.toFixed(2)}`;
        return x;
      }),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 70 },
        2: { halign: "right", cellWidth: 70 },
      },
    });

    doc.save("revenue.pdf");
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

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading revenue…</div>;
  if (err) return <div className="p-8 text-red-300">Error: {err}</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Ledger</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Revenue</h1>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {/* Export chip */}
              <div className="relative" ref={exportRef}>
                <TopChipButton
                  onClick={() => setExportOpen((v) => !v)}
                  disabled={!sorted.length || downloading !== null}
                  title="Download"
                >
                  Export ▾
                </TopChipButton>

                {exportOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden z-20">
                    <button
                      onClick={() => {
                        setExportOpen(false);
                        runDownload("csv");
                      }}
                      disabled={!sorted.length || downloading !== null}
                      className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {downloading === "csv" ? "Preparing…" : "Download CSV"}
                    </button>

                    <button
                      onClick={() => {
                        setExportOpen(false);
                        runDownload("xlsx");
                      }}
                      disabled={!sorted.length || downloading !== null}
                      className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {downloading === "xlsx" ? "Preparing…" : "Download Excel"}
                    </button>

                    <button
                      onClick={() => {
                        setExportOpen(false);
                        runDownload("pdf");
                      }}
                      disabled={!sorted.length || downloading !== null}
                      className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {downloading === "pdf" ? "Preparing…" : "Download PDF"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top totals strip */}
          <div className="w-full md:w-auto">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-white/55">Total (filtered)</div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    ${moneyFmt(totals.sum)}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {totals.count} items • Totals reflect all matching items.
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <RangePill id="all" label="All" />
                  <RangePill id="ytd" label="YTD" />
                  <RangePill id="mtd" label="MTD" />
                  <RangePill id="wtd" label="WTD" />
                  <RangePill id="today" label="Today" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-3">
              <label className="block text-xs text-white/60 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Client, source, note, memo, amount…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <div className="md:col-span-3">
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
          </div>

          <div className="mt-3 text-sm text-white/70">
            {sorted.length} rows • <b className="text-white">${moneyFmt(sorted.reduce((a, x) => a + toMoney(x.amount ?? x.total), 0))}</b>
          </div>
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No revenue entries found for this tenant.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("date_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by date"
                    >
                      Date
                      {sortArrow(sortBy.startsWith("date_"), sortBy === "date_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("amount_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by amount"
                    >
                      Amount
                      {sortArrow(sortBy.startsWith("amount_"), sortBy === "amount_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("desc")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("desc_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by description"
                    >
                      Description
                      {sortArrow(sortBy.startsWith("desc_"), sortBy === "desc_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("job")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("job_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by job"
                    >
                      Job
                      {sortArrow(sortBy.startsWith("job_"), sortBy === "job_asc" ? "asc" : "desc")}
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((x, ix) => {
                  const d = pickDate(x);
                  const amt = toMoney(x.amount ?? x.total);
                  const desc = pickDesc(x);
                  const jobVal = pickJob(x);

                  return (
                    <tr key={stableKey(x, ix)} className="border-b border-white/5">
                      <td className="py-3 pl-4 pr-4 whitespace-nowrap text-white/85">{d}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white">${moneyFmt(amt)}</td>
                      <td className="py-3 pr-4 text-white/75">{desc}</td>
                      <td className="py-3 pr-4 text-white/85">{jobVal}</td>
                    </tr>
                  );
                })}

                <tr className="border-t border-white/10">
                  <td className="py-4 pl-4 pr-4 text-sm text-white/55 font-semibold" colSpan={1}>
                    Total (filtered)
                  </td>
                  <td className="py-4 pr-4 text-lg font-semibold text-white">
                    ${moneyFmt(totals.sum)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
