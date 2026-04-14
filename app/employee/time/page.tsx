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

export default function EmployeeTimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const whoami = await fetchWhoami();
        if (!whoami.ok) { router.replace("/login"); return; }

        const role = whoami.role;
        if (role === "owner" || role === "admin") {
          router.replace("/app/crew/time"); return;
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

        if (!pu?.tenant_id) { router.replace("/login"); return; }

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
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
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

  function statusLabel(status?: string | null) {
    if (!status || status === "confirmed") return null;
    if (status === "pending_review") return { text: "Pending review", color: "text-yellow-400" };
    if (status === "declined") return { text: "Declined", color: "text-red-400" };
    return null;
  }

  if (loading) return <div className="text-sm text-white/60">Loading…</div>;
  if (err) return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
  );

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Time history</h1>
        <div className="mt-1 text-sm text-white/50">Last 30 days</div>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-white/50">
          No time entries yet. Send &quot;clock in [Job #]&quot; via WhatsApp to log your first shift.
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => {
            const badge = statusLabel(e.submission_status);
            return (
              <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm text-white/80">
                      {fmtDateTime(e.clock_in)}
                      {" → "}
                      {e.clock_out ? fmtDateTime(e.clock_out) : <span className="text-green-400">open</span>}
                    </div>
                    {e.job_no && (
                      <div className="mt-0.5 text-xs text-white/50">Job {e.job_no}</div>
                    )}
                    {e.note && (
                      <div className="mt-0.5 text-xs text-white/40 italic">{e.note}</div>
                    )}
                    {badge && (
                      <div className={`mt-1 text-xs ${badge.color}`}>{badge.text}</div>
                    )}
                  </div>
                  <div className="text-sm text-white/40 shrink-0">
                    {calcDuration(e.clock_in, e.clock_out)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
