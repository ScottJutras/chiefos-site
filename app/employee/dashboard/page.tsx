"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";
import Link from "next/link";

type ActivityTab = "timeclock" | "mileage";

type Shift = {
  id: number;
  start_at_utc: string;
  end_at_utc: string | null;
  kind: string;
  meta: any;
};

type MileageLog = {
  id: number;
  trip_date: string;
  origin: string | null;
  destination: string | null;
  distance: number;
  unit: string;
  deductible_cents: number;
  job_name: string | null;
};

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [mileage, setMileage] = useState<MileageLog[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<ActivityTab>("timeclock");

  useEffect(() => {
    (async () => {
      try {
        const whoami = await fetchWhoami();
        if (!whoami.ok) { router.replace("/login"); return; }
        if (whoami.role === "owner" || whoami.role === "admin" || whoami.role === "board") {
          router.replace("/app/dashboard"); return;
        }

        setDisplayName(whoami.email || null);

        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id || "";
        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!pu?.tenant_id) { router.replace("/login"); return; }
        const tid = pu.tenant_id;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [shiftRes, mileageRes] = await Promise.all([
          supabase
            .from("time_entries_v2")
            .select("id, start_at_utc, end_at_utc, kind, meta")
            .eq("tenant_id", tid)
            .eq("kind", "shift")
            .gte("start_at_utc", thirtyDaysAgo)
            .order("start_at_utc", { ascending: false })
            .limit(50),
          supabase
            .from("mileage_logs")
            .select("id, trip_date, origin, destination, distance, unit, deductible_cents, job_name")
            .eq("tenant_id", tid)
            .order("trip_date", { ascending: false })
            .limit(20),
        ]);

        setShifts((shiftRes.data || []) as Shift[]);
        setMileage((mileageRes.data || []) as MileageLog[]);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load dashboard."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function fmtTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  }

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
    catch { return iso; }
  }

  function calcDuration(start: string, end?: string | null) {
    try {
      const s = new Date(start).getTime();
      const e = end ? new Date(end).getTime() : Date.now();
      const mins = Math.round((e - s) / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    } catch { return "—"; }
  }

  if (loading) return <div className="text-sm text-white/60">Loading…</div>;
  if (err) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayShifts = shifts.filter((s) => s.start_at_utc.startsWith(todayStr));
  const openShift = shifts.find((s) => !s.end_at_utc);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        {displayName && <div className="mt-1 text-sm text-white/50">{displayName}</div>}
      </div>

      {/* Status card */}
      <div className={["rounded-2xl border px-4 py-4 mb-4", openShift ? "border-green-500/30 bg-green-500/10" : "border-white/10 bg-white/5"].join(" ")}>
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">Today</div>
        {openShift ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-300">Clocked in</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                Live
              </span>
            </div>
            <div className="text-sm text-white/70 mt-0.5">
              Since {fmtTime(openShift.start_at_utc)}
              {openShift.meta?.job_name ? ` · ${openShift.meta.job_name}` : ""}
              {" · "}{calcDuration(openShift.start_at_utc)}
            </div>
          </div>
        ) : (
          <div>
            <div className="font-semibold text-white/60">Not clocked in</div>
            <div className="mt-1 text-xs text-white/40">Head to the time clock to start a shift.</div>
          </div>
        )}
      </div>

      {/* Today's shifts */}
      {todayShifts.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-2">Today&apos;s shifts</div>
          <div className="grid gap-2">
            {todayShifts.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="text-white/80">{fmtTime(s.start_at_utc)}</span>
                  {" → "}
                  <span className="text-white/60">{s.end_at_utc ? fmtTime(s.end_at_utc) : "open"}</span>
                  {s.meta?.job_name && <span className="text-white/40"> · {s.meta.job_name}</span>}
                </div>
                <div className="text-white/40 text-xs shrink-0">{calcDuration(s.start_at_utc, s.end_at_utc)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">Quick access</div>
        <div className="grid gap-2">
          <Link href="/employee/time-clock" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition">
            <span>Time clock &amp; history</span><span className="text-white/30">→</span>
          </Link>
          <Link href="/employee/mileage" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition">
            <span>Mileage</span><span className="text-white/30">→</span>
          </Link>
          <Link href="/employee/settings" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition">
            <span>Settings (password, logout)</span><span className="text-white/30">→</span>
          </Link>
        </div>
      </div>

      {/* Activity section with tabs */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40">Activity</div>
          <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-0.5">
            {(["timeclock", "mileage"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setActivityTab(t)}
                className={["rounded-lg px-3 py-1 text-xs font-medium transition", activityTab === t ? "bg-white text-black" : "text-white/60 hover:text-white/85"].join(" ")}>
                {t === "timeclock" ? "Time Clock" : "Mileage"}
              </button>
            ))}
          </div>
        </div>

        {activityTab === "timeclock" && (
          shifts.length > 0 ? (
            <div className="grid gap-2">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white/85">
                      {fmtDate(s.start_at_utc)}
                      {s.meta?.job_name && <span className="text-white/50"> · {s.meta.job_name}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">
                      {fmtTime(s.start_at_utc)} → {s.end_at_utc ? fmtTime(s.end_at_utc) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          open
                          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium tabular-nums text-white/85">{calcDuration(s.start_at_utc, s.end_at_utc)}</div>
                    <div className="text-[10px] text-white/40">{s.end_at_utc ? "completed" : "active"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/50 text-center">No time clock entries yet.</div>
          )
        )}

        {activityTab === "mileage" && (
          mileage.length > 0 ? (
            <div className="grid gap-2">
              {mileage.map((m) => {
                const trip = [m.origin, m.destination].filter(Boolean).join(" → ");
                return (
                  <div key={m.id} className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white/85">
                        {String(m.trip_date).slice(0, 10)}
                        {m.job_name && <span className="text-white/50"> · {m.job_name}</span>}
                      </div>
                      {trip && <div className="mt-0.5 text-xs text-white/50">{trip}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium tabular-nums text-white/85">{m.distance} {m.unit}</div>
                      <div className="text-xs text-white/50">${(m.deductible_cents / 100).toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/50 text-center">No mileage entries yet.</div>
          )
        )}
      </div>
    </div>
  );
}
