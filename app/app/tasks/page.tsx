// app/app/tasks/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TaskRow = {
  id?: string;
  created_at?: string;

  status?: string;
  state?: string;

  title?: string;
  name?: string;
  task?: string;

  assigned_to?: string;
  assignee?: string;
  user_id?: string;
};

type SortBy =
  | "created_desc"
  | "created_asc"
  | "status_asc"
  | "status_desc"
  | "title_asc"
  | "title_desc"
  | "assignee_asc"
  | "assignee_desc";

type TotalsRange = "all" | "ytd" | "mtd" | "wtd" | "today";

function pickStatus(x: TaskRow) {
  return String(x.status || x.state || "").trim() || "—";
}

function pickTitle(x: TaskRow) {
  return String(x.title || x.name || x.task || "").trim() || "—";
}

function pickAssignee(x: TaskRow) {
  return String(x.assigned_to || x.assignee || x.user_id || "").trim() || "—";
}

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function pickCreatedIsoDay(x: TaskRow) {
  return isoDay(x.created_at || "") || "—";
}

function pickCreatedPretty(x: TaskRow) {
  const t = String(x.created_at || "").trim();
  return t ? t.slice(0, 19).replace("T", " ") : "—";
}

function stableKey(x: TaskRow, ix: number) {
  return x.id || `${pickCreatedPretty(x)}|${pickStatus(x)}|${pickTitle(x)}|${pickAssignee(x)}|${ix}`;
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

function startOfWeekMondayLocal(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() + diff);
  return out;
}

export default function TasksPage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  // View
  const [sortBy, setSortBy] = useState<SortBy>("created_desc");
  const [totalsRange, setTotalsRange] = useState<TotalsRange>("all");

  // Export menu
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | "pdf" | null>(null);

  function sortArrow(active: boolean, dir: "asc" | "desc") {
    if (!active) return <span className="ml-1 text-white/30">↕</span>;
    return <span className="ml-1 text-white/80">{dir === "asc" ? "▲" : "▼"}</span>;
  }

  function toggleSort(field: "created" | "status" | "title" | "assignee") {
    setSortBy((prev) => {
      const asc: SortBy =
        field === "created"
          ? "created_asc"
          : field === "status"
          ? "status_asc"
          : field === "title"
          ? "title_asc"
          : "assignee_asc";

      const desc: SortBy =
        field === "created"
          ? "created_desc"
          : field === "status"
          ? "status_desc"
          : field === "title"
          ? "title_desc"
          : "assignee_desc";

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
    document.title = "Tasks · ChiefOS";
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

        const r = await fetch(`/api/tasks/list?tenantId=${encodeURIComponent(tenantId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load tasks.");

        setRows((j.rows || []) as TaskRow[]);
      } catch (e: any) {
        setErr(e?.message || "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [gateLoading, tenantId]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = pickStatus(r);
      if (s && s !== "—") set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (rows || [])
      .filter((x) => {
        const s = pickStatus(x);
        if (status !== "all" && s !== status) return false;

        if (!qq) return true;
        const hay = [pickStatus(x), pickTitle(x), pickAssignee(x), pickCreatedPretty(x)]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      })
      .slice();
  }, [rows, q, status]);

  const sorted = useMemo(() => {
    const out = filtered.slice();
    const cmpStr = (a: string, b: string) => String(a).localeCompare(String(b));

    out.sort((A, B) => {
      const aC = pickCreatedPretty(A);
      const bC = pickCreatedPretty(B);
      const aS = pickStatus(A);
      const bS = pickStatus(B);
      const aT = pickTitle(A);
      const bT = pickTitle(B);
      const aA = pickAssignee(A);
      const bA = pickAssignee(B);

      switch (sortBy) {
        case "created_asc":
          return cmpStr(aC, bC);
        case "created_desc":
          return cmpStr(bC, aC);

        case "status_asc":
          return cmpStr(aS, bS);
        case "status_desc":
          return cmpStr(bS, aS);

        case "title_asc":
          return cmpStr(aT, bT);
        case "title_desc":
          return cmpStr(bT, aT);

        case "assignee_asc":
          return cmpStr(aA, bA);
        case "assignee_desc":
          return cmpStr(bA, aA);

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
      const d = pickCreatedIsoDay(e);
      if (!d || d === "—") return false;
      if (totalsRange === "today") return d === todayIso;
      return d >= startIso && d <= todayIso;
    });
  }, [sorted, totalsRange]);

  const totals = useMemo(() => ({ count: totalsList.length }), [totalsList]);

  function buildRows(list: TaskRow[]) {
    const headers = ["#", "Status", "Title", "Assignee", "Created"];
    const rowsOut = list.map((x, ix) => [
      ix + 1,
      pickStatus(x),
      pickTitle(x),
      pickAssignee(x),
      pickCreatedPretty(x),
    ]);
    return { headers, rows: rowsOut };
  }

  function downloadCSV(list: TaskRow[]) {
    if (!list.length) return;
    const { headers, rows: rr } = buildRows(list);
    const csv = [headers, ...rr]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadXLSX(list: TaskRow[]) {
    if (!list.length) return;
    const { headers, rows: rr } = buildRows(list);
    const data = [headers, ...rr];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 40 }, { wch: 22 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, "tasks.xlsx");
  }

  function downloadPDF(list: TaskRow[]) {
    if (!list.length) return;
    const { headers, rows: rr } = buildRows(list);

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    doc.setFontSize(14);
    doc.text("Tasks", 40, 40);

    autoTable(doc, {
      startY: 60,
      head: [headers],
      body: rr,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 24 } },
    });

    doc.save("tasks.pdf");
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

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading tasks…</div>;
  if (err) return <div className="p-8 text-red-300">Error: {err}</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Ledger</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Tasks</h1>

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
                  <div className="mt-1 text-2xl font-semibold text-white">{totals.count}</div>
                  <div className="mt-1 text-xs text-white/55">
                    Tasks match filters (not just what’s visible).
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
            <div className="md:col-span-4">
              <label className="block text-xs text-white/60 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Title, assignee, status…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-white/60 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
              >
                <option value="all">All</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 text-sm text-white/70">{sorted.length} rows</div>
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No tasks found for this tenant.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("status_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by status"
                    >
                      Status
                      {sortArrow(sortBy.startsWith("status_"), sortBy === "status_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("title")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("title_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by title"
                    >
                      Title
                      {sortArrow(sortBy.startsWith("title_"), sortBy === "title_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("assignee")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("assignee_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by assignee"
                    >
                      Assignee
                      {sortArrow(sortBy.startsWith("assignee_"), sortBy === "assignee_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("created")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("created_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by created time"
                    >
                      Created
                      {sortArrow(sortBy.startsWith("created_"), sortBy === "created_asc" ? "asc" : "desc")}
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((x, ix) => (
                  <tr key={stableKey(x, ix)} className="border-b border-white/5">
                    <td className="py-3 pl-4 pr-4 whitespace-nowrap text-white/85">
                      {pickStatus(x)}
                    </td>
                    <td className="py-3 pr-4 text-white/80">{pickTitle(x)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/60">
                      {pickAssignee(x)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/60">
                      {pickCreatedPretty(x)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
