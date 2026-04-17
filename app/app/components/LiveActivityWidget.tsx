"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActiveShift = {
  id: number;
  employee_name: string;
  start_at_utc: string;
  job_name: string | null;
};

function elapsed(start: string) {
  const ms = Date.now() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function totalActiveHours(shifts: ActiveShift[]) {
  const now = Date.now();
  const total = shifts.reduce((sum, s) => sum + (now - new Date(s.start_at_utc).getTime()), 0);
  const h = total / 3600000;
  return h < 0.1 ? "0h" : h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;
}

export default function LiveActivityWidget({ jobId }: { jobId?: number }) {
  const [shifts, setShifts] = useState<ActiveShift[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return;
        const qs = jobId ? `?job_id=${jobId}` : "";
        const r = await fetch(`/api/timeclock/active-shifts${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (alive && j.ok) setShifts(j.shifts || []);
      } catch {}
    }
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, [jobId]);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  if (!shifts.length) return null;

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            On Site
          </span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400">
            {shifts.length}
          </span>
        </div>
        <span className="text-xs tabular-nums text-emerald-400/60">{totalActiveHours(shifts)} total</span>
      </div>
      <div className="space-y-2">
        {shifts.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2.5">
            <div className="min-w-0">
              <span className="font-medium text-white/90">{s.employee_name}</span>
              {s.job_name && (
                <span className="ml-2 text-xs text-white/50">{s.job_name}</span>
              )}
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-emerald-400">{elapsed(s.start_at_utc)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
