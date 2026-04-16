"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import CrewMileageCard from "@/app/app/components/CrewMileageCard";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type MileageLog = {
  id: number;
  tenant_id: string;
  owner_id: string;
  job_id?: number | null;
  job_name?: string | null;
  trip_date: string;
  origin?: string | null;
  destination?: string | null;
  distance: number;
  unit: string; // "km" | "mi"
  rate_cents: number;
  deductible_cents: number;
  notes?: string | null;
  source_msg_id?: string | null;
  created_at: string;
  employee_user_id?: string | null;
  _employee_name?: string | null;
};

type SortBy = "date_desc" | "date_asc" | "distance_desc" | "distance_asc" | "job_asc" | "job_desc";
type TotalsRange = "all" | "ytd" | "mtd" | "wtd" | "today";

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function moneyFmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function chip(cls: string) {
  return ["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", cls].join(" ");
}

function startOfWeekMondayLocal(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() + diff);
  return out;
}

export default function MileagePage() {
  const { loading: gateLoading } = useTenantGate();

  const [logs, setLogs] = useState<MileageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantCountry, setTenantCountry] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [sortBy, setSortBy] = useState<SortBy>("date_desc");
  const [totalsRange, setTotalsRange] = useState<TotalsRange>("ytd");

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    document.title = "Mileage · ChiefOS";
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!exportRef.current) return;
      if (e.target instanceof Node && !exportRef.current.contains(e.target)) setExportOpen(false);
    }
    if (exportOpen) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  useEffect(() => {
    let cancelled = false;
    if (gateLoading) return;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("mileage_logs")
          .select("*")
          .order("trip_date", { ascending: false });

        if (error) throw error;

        // Resolve employee_user_id → display_name. Build a comprehensive
        // lookup by phone_digits AND by portal:actorId prefix so we can
        // match both phone-linked and portal-only employees.
        const rawLogs = (data ?? []) as MileageLog[];

        let idToName: Record<string, string> = {};
        try {
          const { data: profiles } = await supabase
            .from("chiefos_tenant_actor_profiles")
            .select("actor_id, phone_digits, display_name");
          for (const p of (profiles || []) as any[]) {
            if (!p.display_name) continue;
            if (p.phone_digits) idToName[p.phone_digits] = p.display_name;
            if (p.actor_id) idToName[`portal:${String(p.actor_id).slice(0, 16)}`] = p.display_name;
          }
        } catch {
          // fail-soft
        }

        for (const log of rawLogs) {
          if (log.employee_user_id && idToName[log.employee_user_id]) {
            log._employee_name = idToName[log.employee_user_id];
          }
        }

        if (!cancelled) setLogs(rawLogs);

        const { data: td } = await supabase
          .from("chiefos_tenants")
          .select("country")
          .limit(1)
          .maybeSingle();
        if (!cancelled && td?.country) setTenantCountry(String(td.country).toUpperCase());
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load mileage logs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateLoading, reloadKey]);

  const jobs = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      const j = String(l.job_name || "").trim();
      if (j) set.add(j);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return logs.filter((l) => {
      const day = isoDay(l.trip_date);
      if (fromDate && day && day < fromDate) return false;
      if (toDate && day && day > toDate) return false;
      if (jobFilter !== "all" && String(l.job_name || "").trim() !== jobFilter) return false;
      if (!qq) return true;
      const hay = [
        l.job_name ?? "",
        l.origin ?? "",
        l.destination ?? "",
        l.notes ?? "",
        isoDay(l.trip_date),
        String(l.distance ?? ""),
        l.unit ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(qq);
    });
  }, [logs, q, fromDate, toDate, jobFilter]);

  const sorted = useMemo(() => {
    const out = filtered.slice();
    out.sort((A, B) => {
      const aD = isoDay(A.trip_date);
      const bD = isoDay(B.trip_date);
      switch (sortBy) {
        case "date_asc": return aD.localeCompare(bD);
        case "date_desc": return bD.localeCompare(aD);
        case "distance_asc": return A.distance - B.distance;
        case "distance_desc": return B.distance - A.distance;
        case "job_asc": return String(A.job_name || "").localeCompare(String(B.job_name || ""));
        case "job_desc": return String(B.job_name || "").localeCompare(String(A.job_name || ""));
        default: return 0;
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
      totalsRange === "ytd" ? isoDay(startYTD.toISOString()) :
      totalsRange === "mtd" ? isoDay(startMTD.toISOString()) :
      totalsRange === "wtd" ? isoDay(startWTD.toISOString()) :
      todayIso;
    return sorted.filter((l) => {
      const d = isoDay(l.trip_date);
      if (!d) return false;
      if (totalsRange === "today") return d === todayIso;
      return d >= startIso && d <= todayIso;
    });
  }, [sorted, totalsRange]);

  const totals = useMemo(() => {
    const count = totalsList.length;
    const km = totalsList.filter(l => l.unit === "km").reduce((acc, l) => acc + Number(l.distance || 0), 0);
    const mi = totalsList.filter(l => l.unit === "mi").reduce((acc, l) => acc + Number(l.distance || 0), 0);
    const deductible = totalsList.reduce((acc, l) => acc + Number(l.deductible_cents || 0), 0) / 100;
    return { count, km, mi, deductible };
  }, [totalsList]);

  // CRA rate note for CA users
  const ytdKm = useMemo(() => {
    const now = new Date();
    const startYTD = isoDay(new Date(now.getFullYear(), 0, 1).toISOString());
    return logs
      .filter(l => l.unit === "km" && isoDay(l.trip_date) >= startYTD)
      .reduce((acc, l) => acc + Number(l.distance || 0), 0);
  }, [logs]);

  function buildRows(list: MileageLog[]) {
    const headers = ["#", "Date", "Origin", "Destination", "Distance", "Unit", "Rate (¢/unit)", "Deductible", "Job", "Notes"];
    const rows = list.map((l, ix) => [
      ix + 1,
      isoDay(l.trip_date),
      l.origin ?? "",
      l.destination ?? "",
      l.distance,
      l.unit,
      l.rate_cents,
      (l.deductible_cents / 100).toFixed(2),
      l.job_name ?? "",
      l.notes ?? "",
    ]);
    return { headers, rows };
  }

  function downloadCSV(list: MileageLog[]) {
    if (!list.length) return;
    const { headers, rows } = buildRows(list);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mileage.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadXLSX(list: MileageLog[]) {
    if (!list.length) return;
    const { headers, rows } = buildRows(list);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 4 }, { wch: 12 }, { wch: 24 }, { wch: 24 },
      { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 26 }, { wch: 32 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mileage");
    XLSX.writeFile(wb, "mileage.xlsx");
  }

  function downloadPDF(list: MileageLog[]) {
    if (!list.length) return;
    const { headers, rows } = buildRows(list);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    doc.setFontSize(14);
    doc.text("Mileage Log", 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [headers],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fontSize: 8 },
    });
    doc.save("mileage.pdf");
  }

  async function runDownload(kind: "csv" | "xlsx" | "pdf") {
    if (!sorted.length || downloading) return;
    try {
      setDownloading(kind);
      if (kind === "csv") downloadCSV(sorted);
      if (kind === "xlsx") downloadXLSX(sorted);
      if (kind === "pdf") downloadPDF(sorted);
    } finally {
      setDownloading(null);
    }
  }

  const sortArrow = (active: boolean, dir: "asc" | "desc") => {
    if (!active) return <span className="ml-1 text-white/30">↕</span>;
    return <span className="ml-1 text-white/80">{dir === "asc" ? "▲" : "▼"}</span>;
  };

  const toggleSort = (field: "date" | "distance" | "job") => {
    setSortBy((prev) => {
      const desc = (field + "_desc") as SortBy;
      const asc = (field + "_asc") as SortBy;
      return prev === desc ? asc : desc;
    });
  };

  const RangePill = ({ id, label }: { id: TotalsRange; label: string }) => {
    const active = totalsRange === id;
    return (
      <button
        type="button"
        onClick={() => setTotalsRange(id)}
        className={[
          "rounded-full border px-3 py-1 text-xs transition",
          active ? "border-white/20 bg-white text-black" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading mileage…</div>;
  if (error) return <div className="p-8 text-red-300">Error: {error}</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Crew mileage log card — owner/admin/board can log for self or team */}
        <CrewMileageCard onActivity={() => setReloadKey((k) => k + 1)} />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className={chip("border-white/10 bg-white/5 text-white/60")}>Activity</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Mileage log</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Track business trips and auto-calculated deductible amounts. Log via WhatsApp: "drove 45km to Harris job."
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-w-[280px]">
            <div className="text-xs text-white/50">Deductible total</div>
            <div className="mt-1 text-2xl font-semibold text-white">${moneyFmt(totals.deductible)}</div>
            <div className="mt-1 text-xs text-white/50">
              {totals.count} trips
              {totals.km > 0 ? ` • ${totals.km.toFixed(1)} km` : ""}
              {totals.mi > 0 ? ` • ${totals.mi.toFixed(1)} mi` : ""}
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <RangePill id="all" label="All" />
              <RangePill id="ytd" label="YTD" />
              <RangePill id="mtd" label="MTD" />
              <RangePill id="wtd" label="WTD" />
              <RangePill id="today" label="Today" />
            </div>
          </div>
        </div>

        {/* CRA tiered rate note for CA */}
        {tenantCountry === "CA" && (
          <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-100/80">
            <b>CRA rates:</b> $0.72/km for first 5,000 km/year, $0.66/km after.{" "}
            <span className="text-white/50">YTD km (all trips): {ytdKm.toFixed(1)} km</span>
          </div>
        )}
        {tenantCountry === "US" && (
          <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-100/80">
            <b>IRS rate:</b> $0.67/mile (2024).
          </div>
        )}

        {/* Export */}
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!sorted.length || downloading !== null}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition disabled:opacity-50"
            >
              Export ▾
            </button>

            {exportOpen && (
              <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden z-20">
                {(["csv", "xlsx", "pdf"] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => { setExportOpen(false); runDownload(kind); }}
                    disabled={!sorted.length || downloading !== null}
                    className="w-full text-left px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                  >
                    {downloading === kind ? "Preparing…" : `Download ${kind.toUpperCase()}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-white/60 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Origin, destination, job, notes…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Job</label>
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="all">All jobs</option>
                {jobs.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-white/60 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-white/60 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/60">No mileage logs found.</p>
            <p className="mt-2 text-sm text-white/40">
              Log a trip via WhatsApp: "drove 45km to Harris job" or "35 miles to the Maple site."
            </p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4 w-10">#</th>
                  <th className="py-3 pr-4">Employee</th>
                  <th className="py-3 pr-4">
                    <button type="button" onClick={() => toggleSort("date")}
                      className={["inline-flex items-center hover:text-white transition", sortBy.startsWith("date_") ? "text-white" : "text-white/60"].join(" ")}>
                      Date {sortArrow(sortBy.startsWith("date_"), sortBy === "date_asc" ? "asc" : "desc")}
                    </button>
                  </th>
                  <th className="py-3 pr-4">Trip</th>
                  <th className="py-3 pr-4">
                    <button type="button" onClick={() => toggleSort("distance")}
                      className={["inline-flex items-center hover:text-white transition", sortBy.startsWith("distance_") ? "text-white" : "text-white/60"].join(" ")}>
                      Distance {sortArrow(sortBy.startsWith("distance_"), sortBy === "distance_asc" ? "asc" : "desc")}
                    </button>
                  </th>
                  <th className="py-3 pr-4">Rate</th>
                  <th className="py-3 pr-4">Deductible</th>
                  <th className="py-3 pr-4">
                    <button type="button" onClick={() => toggleSort("job")}
                      className={["inline-flex items-center hover:text-white transition", sortBy.startsWith("job_") ? "text-white" : "text-white/60"].join(" ")}>
                      Job {sortArrow(sortBy.startsWith("job_"), sortBy === "job_asc" ? "asc" : "desc")}
                    </button>
                  </th>
                  <th className="py-3 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((l, ix) => {
                  const trip = [l.origin, l.destination].filter(Boolean).join(" → ");
                  const rateDollars = (l.rate_cents / 100).toFixed(2);
                  const deductible = (l.deductible_cents / 100);
                  return (
                    <tr key={l.id} className="border-b border-white/5">
                      <td className="py-3 pl-4 pr-4 text-white/45">{ix + 1}</td>
                      <td className="py-3 pr-4 text-white/75">{l._employee_name || "Owner"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/85">{isoDay(l.trip_date)}</td>
                      <td className="py-3 pr-4 text-white/75">{trip || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/85">
                        {l.distance} {l.unit}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/60">
                        ${rateDollars}/{l.unit}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap font-medium text-white">
                        ${moneyFmt(deductible)}
                      </td>
                      <td className="py-3 pr-4 text-white/75">{l.job_name ?? "—"}</td>
                      <td className="py-3 pr-4 text-white/55">{l.notes ?? ""}</td>
                    </tr>
                  );
                })}

                <tr className="border-t border-white/10">
                  <td className="py-4 pl-4 pr-4 text-sm text-white/55 font-semibold" colSpan={6}>
                    Total (filtered)
                  </td>
                  <td className="py-4 pr-4 text-lg font-semibold text-white">
                    ${moneyFmt(sorted.reduce((acc, l) => acc + l.deductible_cents / 100, 0))}
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
