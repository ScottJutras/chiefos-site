"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";
import Link from "next/link";

type TimeEntry = {
  id: string;
  clock_in: string;
  clock_out?: string | null;
  job_no?: string | null;
  note?: string | null;
};

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Verify auth + role
        const whoami = await fetchWhoami();
        if (!whoami.ok) {
          router.replace("/login");
          return;
        }

        // Redirect owners to their dashboard
        const role = whoami.role;
        if (role === "owner" || role === "admin") {
          router.replace("/app/dashboard");
          return;
        }

        // Load user display info
        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id || "";

        // Load portal membership to get tenant + actor
        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id, role")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!pu?.tenant_id) {
          router.replace("/login");
          return;
        }

        // Load today's time entries (via Supabase RLS — employee sees their own)
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: todayRows } = await supabase
          .from("time_entries_v2")
          .select("id, clock_in, clock_out, job_no, note")
          .eq("tenant_id", pu.tenant_id)
          .gte("clock_in", todayStr + "T00:00:00.000Z")
          .order("clock_in", { ascending: false })
          .limit(10);

        setTodayEntries((todayRows || []) as TimeEntry[]);

        // Load recent entries (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentRows } = await supabase
          .from("time_entries_v2")
          .select("id, clock_in, clock_out, job_no, note")
          .eq("tenant_id", pu.tenant_id)
          .gte("clock_in", sevenDaysAgo)
          .order("clock_in", { ascending: false })
          .limit(20);

        setRecentEntries((recentRows || []) as TimeEntry[]);
        setDisplayName(user?.user?.email || null);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load dashboard."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function fmtTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  }

  function fmtDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    } catch { return iso; }
  }

  function calcDuration(clockIn: string, clockOut?: string | null) {
    try {
      const start = new Date(clockIn).getTime();
      const end = clockOut ? new Date(clockOut).getTime() : Date.now();
      const mins = Math.round((end - start) / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    } catch { return "—"; }
  }

  if (loading) {
    return (
      <div className="text-sm text-white/60">Loading…</div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {err}
      </div>
    );
  }

  const openEntry = todayEntries.find((e) => !e.clock_out);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        {displayName && (
          <div className="mt-1 text-sm text-white/50">{displayName}</div>
        )}
      </div>

      {/* Status card */}
      <div className={[
        "rounded-2xl border px-4 py-4 mb-4",
        openEntry
          ? "border-green-500/30 bg-green-500/10"
          : "border-white/10 bg-white/5",
      ].join(" ")}>
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">
          Today
        </div>
        {openEntry ? (
          <div>
            <div className="font-semibold text-green-300">Clocked in</div>
            <div className="text-sm text-white/70 mt-0.5">
              Since {fmtTime(openEntry.clock_in)}
              {openEntry.job_no ? ` · Job ${openEntry.job_no}` : ""}
              {" · "}{calcDuration(openEntry.clock_in)}
            </div>
            <div className="mt-2 text-xs text-white/40">
              Send "clock out" via WhatsApp to end shift.
            </div>
          </div>
        ) : (
          <div>
            <div className="font-semibold text-white/60">Not clocked in</div>
            <div className="mt-2 text-xs text-white/40">
              Send "clock in [Job #]" via WhatsApp to start a shift.
            </div>
          </div>
        )}
      </div>

      {/* Today's shifts */}
      {todayEntries.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
            Today&apos;s shifts
          </div>
          <div className="grid gap-2">
            {todayEntries.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="text-white/80">{fmtTime(e.clock_in)}</span>
                  {" → "}
                  <span className="text-white/60">
                    {e.clock_out ? fmtTime(e.clock_out) : "open"}
                  </span>
                  {e.job_no && (
                    <span className="text-white/40"> · Job {e.job_no}</span>
                  )}
                </div>
                <div className="text-white/40 text-xs shrink-0">
                  {calcDuration(e.clock_in, e.clock_out)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">
          Quick access
        </div>
        <div className="grid gap-2">
          <Link
            href="/employee/time"
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition"
          >
            <span>Time history</span>
            <span className="text-white/30">→</span>
          </Link>
        </div>
      </div>

      {/* Recent entries summary */}
      {recentEntries.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-2">
            Last 7 days
          </div>
          <div className="grid gap-1.5">
            {recentEntries.slice(0, 7).map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-2 text-xs text-white/60">
                <span>{fmtDate(e.clock_in)}{e.job_no ? ` · Job ${e.job_no}` : ""}</span>
                <span className="text-white/40 shrink-0">{calcDuration(e.clock_in, e.clock_out)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
