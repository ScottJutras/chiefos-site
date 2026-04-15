"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";

type TimeEntry = {
  id: string;
  clock_in: string;
  clock_out?: string | null;
  job_no?: string | null;
  note?: string | null;
  submission_status?: string | null;
};

export default function EmployeeTimeClockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const w = await fetchWhoami();
        if (!w?.ok) {
          router.replace("/login");
          return;
        }
        const role = String(w.role || "").toLowerCase();
        if (role === "owner" || role === "admin" || role === "board") {
          router.replace("/app/activity/time");
          return;
        }

        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id || "";
        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pu?.tenant_id) {
          router.replace("/login");
          return;
        }

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rows } = await supabase
          .from("time_entries_v2")
          .select("id, clock_in, clock_out, job_no, note, submission_status")
          .eq("tenant_id", pu.tenant_id)
          .gte("clock_in", thirtyDaysAgo)
          .order("clock_in", { ascending: false })
          .limit(100);
        setEntries((rows || []) as TimeEntry[]);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load time entries."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function fmtDateTime(iso: string) {
    try {
      return new Date(iso).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function calcDuration(clockIn: string, clockOut?: string | null) {
    try {
      const start = new Date(clockIn).getTime();
      const end = clockOut ? new Date(clockOut).getTime() : Date.now();
      const mins = Math.round((end - start) / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    } catch {
      return "—";
    }
  }

  function statusBadge(status?: string | null) {
    if (!status || status === "confirmed") return null;
    if (status === "pending_review") return { text: "Pending review", color: "text-yellow-400" };
    if (status === "declined") return { text: "Declined", color: "text-red-400" };
    return null;
  }

  const openEntry = entries.find((e) => !e.clock_out);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Time clock
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Your shifts
        </h1>
        <div className="mt-1 text-sm text-white/55">Last 30 days</div>
      </div>

      {/* Current status card */}
      <div
        className={[
          "rounded-2xl border px-4 py-4 mb-4",
          openEntry ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/5",
        ].join(" ")}
      >
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">
          Status
        </div>
        {openEntry ? (
          <>
            <div className="font-semibold text-emerald-300">Clocked in</div>
            <div className="mt-0.5 text-sm text-white/70">
              Since {fmtDateTime(openEntry.clock_in)}
              {openEntry.job_no ? ` · Job ${openEntry.job_no}` : ""}
              {" · "}
              {calcDuration(openEntry.clock_in)}
            </div>
          </>
        ) : (
          <div className="font-semibold text-white/60">Not clocked in</div>
        )}
        <div className="mt-2 text-xs text-white/40">
          Send "clock in [Job #]" or "clock out" via WhatsApp to start or end a shift.
          Web portal clock-in is coming soon.
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">
          History
        </div>
        {loading ? (
          <div className="text-sm text-white/50">Loading…</div>
        ) : err ? (
          <div className="text-sm text-red-300">{err}</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-white/50">
            No time entries yet. Send "clock in [Job #]" via WhatsApp to log your first shift.
          </div>
        ) : (
          <div className="grid gap-2">
            {entries.map((e) => {
              const badge = statusBadge(e.submission_status);
              return (
                <div key={e.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <span className="text-white/80">{fmtDateTime(e.clock_in)}</span>
                      {" → "}
                      <span className="text-white/60">
                        {e.clock_out ? fmtDateTime(e.clock_out) : <span className="text-emerald-400">open</span>}
                      </span>
                      {e.job_no && <span className="text-white/40"> · Job {e.job_no}</span>}
                      {e.note && <div className="mt-0.5 text-xs italic text-white/40">{e.note}</div>}
                      {badge && <div className={`mt-1 text-xs ${badge.color}`}>{badge.text}</div>}
                    </div>
                    <div className="shrink-0 text-xs text-white/40">
                      {calcDuration(e.clock_in, e.clock_out)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
