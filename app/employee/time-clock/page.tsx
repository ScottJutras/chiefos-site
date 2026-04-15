"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";
import { useEmployeeJobs } from "../hooks/useEmployeeJobs";

type TimeEntry = {
  id: string;
  clock_in?: string | null;
  clock_out?: string | null;
  start_at_utc?: string | null;
  end_at_utc?: string | null;
  job_no?: string | null;
  kind?: string | null;
  note?: string | null;
  submission_status?: string | null;
  meta?: { job_name?: string | null; note?: string | null } | null;
};

type ClockStatus = {
  clocked_in: boolean;
  open_shift: { id: string; start_at_utc: string; job_name: string | null } | null;
};

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
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

function duration(startIso?: string | null, endIso?: string | null) {
  if (!startIso) return "—";
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const mins = Math.max(0, Math.round((end - start) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch {
    return "—";
  }
}

export default function EmployeeTimeClockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>("");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const { jobs, loading: jobsLoading } = useEmployeeJobs();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const loadHistory = useCallback(async (tid: string) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("time_entries_v2")
        .select("id, clock_in, clock_out, start_at_utc, end_at_utc, job_no, kind, note, submission_status, meta")
        .eq("tenant_id", tid)
        .gte("start_at_utc", thirtyDaysAgo)
        .order("start_at_utc", { ascending: false })
        .limit(100);
      setEntries((rows || []) as TimeEntry[]);
    } catch {
      // fail-soft
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const r = await authedFetch("/api/employee/time/status");
      const j = await r.json();
      if (j?.ok) setStatus({ clocked_in: !!j.clocked_in, open_shift: j.open_shift || null });
    } catch {
      // fail-soft
    }
  }, []);

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

        setTenantId(pu.tenant_id);
        await Promise.all([loadHistory(pu.tenant_id), loadStatus()]);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load time clock."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadHistory, loadStatus]);

  // Re-poll every 30s while clocked in so the "open shift" duration ticks.
  useEffect(() => {
    if (!status?.clocked_in) return;
    const t = setInterval(() => {
      setEntries((prev) => [...prev]); // trigger re-render so duration recalculates
    }, 30000);
    return () => clearInterval(t);
  }, [status?.clocked_in]);

  async function clockIn() {
    setErr(null);
    setOkMsg(null);
    setBusy("in");
    try {
      const body = {
        job_id: selectedJobId ? Number(selectedJobId) : undefined,
        note: note.trim() || undefined,
      };
      const r = await authedFetch("/api/employee/time/clock-in", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Clock-in failed.");
      setOkMsg("Clocked in.");
      setSelectedJobId("");
      setNote("");
      await Promise.all([loadHistory(tenantId), loadStatus()]);
    } catch (e: any) {
      setErr(String(e?.message || "Could not clock in."));
    } finally {
      setBusy(null);
    }
  }

  async function clockOut() {
    setErr(null);
    setOkMsg(null);
    setBusy("out");
    try {
      const r = await authedFetch("/api/employee/time/clock-out", { method: "POST" });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Clock-out failed.");
      const mins = Number(j?.duration_minutes || 0);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setOkMsg(h > 0 ? `Clocked out — ${h}h ${m}m shift.` : `Clocked out — ${m}m shift.`);
      await Promise.all([loadHistory(tenantId), loadStatus()]);
    } catch (e: any) {
      setErr(String(e?.message || "Could not clock out."));
    } finally {
      setBusy(null);
    }
  }

  const open = status?.open_shift || null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Time clock
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Your shifts
        </h1>
      </div>

      {/* Clock in / out card */}
      <div
        className={[
          "rounded-2xl border px-4 py-4 mb-4",
          status?.clocked_in
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-white/10 bg-white/5",
        ].join(" ")}
      >
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">
          {status?.clocked_in ? "On the clock" : "Not clocked in"}
        </div>

        {status?.clocked_in && open ? (
          <>
            <div className="font-semibold text-emerald-300">
              Since {fmtDateTime(open.start_at_utc)}
            </div>
            <div className="mt-0.5 text-sm text-white/70">
              {duration(open.start_at_utc)}
              {open.job_name ? ` · ${open.job_name}` : ""}
            </div>

            <button
              onClick={clockOut}
              disabled={busy !== null}
              className={[
                "mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                busy !== null
                  ? "bg-red-500/30 text-white/40 cursor-not-allowed"
                  : "bg-red-500 text-white hover:bg-red-600",
              ].join(" ")}
            >
              {busy === "out" ? "Clocking out…" : "Clock out"}
            </button>
          </>
        ) : (
          <>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                disabled={jobsLoading}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-50"
              >
                <option value="">
                  {jobsLoading
                    ? "Loading jobs…"
                    : jobs.length === 0
                    ? "No active jobs"
                    : "Select a job (optional)"}
                </option>
                {jobs.map((j) => (
                  <option key={j.id} value={String(j.id)}>
                    {j.job_no ? `#${j.job_no} · ` : ""}
                    {j.name}
                  </option>
                ))}
              </select>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
              />
            </div>
            <button
              onClick={clockIn}
              disabled={busy !== null}
              className={[
                "mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                busy !== null
                  ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
                  : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
              ].join(" ")}
            >
              {busy === "in" ? "Clocking in…" : "Clock in"}
            </button>
          </>
        )}

        {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
        {okMsg && <div className="mt-3 text-xs text-emerald-300">{okMsg}</div>}

        <div className="mt-3 text-xs text-white/35">
          You can also send "clock in [Job #]" or "clock out" via WhatsApp.
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">
          Last 30 days
        </div>
        {loading ? (
          <div className="text-sm text-white/50">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-white/50">
            No shifts yet. Tap "Clock in" above to log your first one.
          </div>
        ) : (
          <div className="grid gap-2">
            {entries.map((e) => {
              const startIso = e.start_at_utc || e.clock_in || null;
              const endIso = e.end_at_utc || e.clock_out || null;
              const jobLabel = e.meta?.job_name || null;
              return (
                <div key={e.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <div className="text-white/80">
                        {fmtDateTime(startIso)}
                        {" → "}
                        <span className="text-white/60">
                          {endIso ? fmtDateTime(endIso) : <span className="text-emerald-400">open</span>}
                        </span>
                      </div>
                      {jobLabel && <div className="text-xs text-white/40">{jobLabel}</div>}
                      {e.note && <div className="mt-0.5 text-xs italic text-white/40">{e.note}</div>}
                    </div>
                    <div className="shrink-0 text-xs text-white/40">
                      {duration(startIso, endIso)}
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
