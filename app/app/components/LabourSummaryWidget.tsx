"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TimeRow = {
  employee_name: string | null;
  type: string;
  timestamp: string;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function calcHoursFromPairs(rows: TimeRow[]): { total: number; perEmployee: Map<string, number> } {
  const perEmployee = new Map<string, number>();
  // Group by employee, sort by time, pair clock_in/clock_out
  const byEmp = new Map<string, TimeRow[]>();
  for (const r of rows) {
    const name = r.employee_name || "Unknown";
    if (!byEmp.has(name)) byEmp.set(name, []);
    byEmp.get(name)!.push(r);
  }

  let total = 0;
  for (const [name, entries] of byEmp) {
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let hours = 0;
    let lastIn: Date | null = null;
    for (const e of entries) {
      if (e.type === "clock_in") {
        lastIn = new Date(e.timestamp);
      } else if (e.type === "clock_out" && lastIn) {
        hours += (new Date(e.timestamp).getTime() - lastIn.getTime()) / 3600000;
        lastIn = null;
      }
    }
    // If still clocked in, count up to now
    if (lastIn) {
      hours += (Date.now() - lastIn.getTime()) / 3600000;
    }
    perEmployee.set(name, hours);
    total += hours;
  }
  return { total, perEmployee };
}

function fmtHours(h: number) {
  return h < 0.1 ? "0h" : h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
}

function fmtMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function LabourSummaryWidget() {
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [estPayroll, setEstPayroll] = useState(0);
  const [ratesCoverage, setRatesCoverage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const weekStart = startOfWeek();
        const todayStart = startOfToday();

        const [{ data: weekRows }, { data: todayRows }, { data: rates }] = await Promise.all([
          supabase
            .from("time_entries")
            .select("employee_name, type, timestamp")
            .is("deleted_at", null)
            .in("type", ["clock_in", "clock_out"])
            .gte("timestamp", weekStart),
          supabase
            .from("time_entries")
            .select("employee_name, type, timestamp")
            .is("deleted_at", null)
            .in("type", ["clock_in", "clock_out"])
            .gte("timestamp", todayStart),
          supabase
            .from("chiefos_crew_rates")
            .select("employee_name, hourly_rate_cents")
            .order("effective_from", { ascending: false }),
        ]);

        if (!alive) return;

        const weekCalc = calcHoursFromPairs((weekRows || []) as TimeRow[]);
        const todayCalc = calcHoursFromPairs((todayRows || []) as TimeRow[]);

        // Build rate map (latest rate per employee)
        const rateMap = new Map<string, number>();
        for (const r of (rates || []) as any[]) {
          const name = String(r.employee_name || "").trim().toLowerCase();
          if (name && !rateMap.has(name)) rateMap.set(name, Number(r.hourly_rate_cents || 0));
        }

        // Estimate payroll
        let payroll = 0;
        let withRate = 0;
        for (const [name, hours] of weekCalc.perEmployee) {
          const rate = rateMap.get(name.toLowerCase());
          if (rate) {
            payroll += hours * rate;
            withRate++;
          }
        }

        setTodayHours(todayCalc.total);
        setWeekHours(weekCalc.total);
        setEstPayroll(payroll);

        const totalCrew = weekCalc.perEmployee.size;
        if (totalCrew > 0 && withRate < totalCrew) {
          setRatesCoverage(`${withRate} of ${totalCrew} crew have rates set`);
        } else {
          setRatesCoverage("");
        }
      } catch {
        // fail-soft
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return null;
  if (todayHours === 0 && weekHours === 0 && estPayroll === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/40">Hours today</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-white/90">{fmtHours(todayHours)}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/40">Hours this week</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-white/90">{fmtHours(weekHours)}</div>
      </div>
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
        <div className="text-[10px] uppercase tracking-widest text-amber-400/70">Est. payroll</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-amber-400">{fmtMoney(estPayroll)}</div>
        {ratesCoverage && <div className="mt-1 text-[10px] text-amber-400/50">{ratesCoverage}</div>}
      </div>
    </div>
  );
}
