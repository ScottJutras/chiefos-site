"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SegmentKind = "break" | "lunch" | "drive";

type ActorOption = {
  actor_id: string;
  role: string;
  display_name: string;
  is_self: boolean;
  is_allowed: boolean;
};

type OpenSegment = {
  id: string;
  kind: SegmentKind;
  start_at_utc: string;
};

type ClockStatus = {
  target: {
    actor_id: string;
    role: string;
    display_name: string;
    is_self: boolean;
  };
  clocked_in: boolean;
  open_shift: { id: string; start_at_utc: string; job_name: string | null } | null;
  open_segments: OpenSegment[];
};

type JobOption = {
  id: number;
  job_no: number | null;
  name: string;
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

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

/**
 * Crew clock card for the owner portal. Lets the authenticated
 * owner/admin/board act on themselves OR on any allowed teammate
 * (permission matrix enforced server-side). Rendered at the top of
 * /app/activity/time above the history table.
 */
export default function CrewClockCard({
  onActivity,
}: {
  onActivity?: () => void;
}) {
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [actorsErr, setActorsErr] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string>("");
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [note, setNote] = useState("");

  type BusyAction = "in" | "out" | `${SegmentKind}:start` | `${SegmentKind}:stop` | null;
  const [busy, setBusy] = useState<BusyAction>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Load selectable actors + jobs once on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [actorsResp, jobsResp] = await Promise.all([
          authedFetch("/api/timeclock/actors"),
          authedFetch("/api/timeclock/jobs"),
        ]);
        const aj = await actorsResp.json();
        const jj = await jobsResp.json();
        if (!alive) return;
        if (aj?.ok && Array.isArray(aj.items)) {
          const items = aj.items as ActorOption[];
          setActors(items);
          // Default the selection to "me" (the caller) if present.
          const me = items.find((i) => i.is_self);
          setSelectedActorId(me?.actor_id || items[0]?.actor_id || "");
        } else {
          setActorsErr(aj?.message || "Could not load team list.");
        }
        if (jj?.ok && Array.isArray(jj.items)) {
          setJobs(jj.items as JobOption[]);
        }
      } catch (e: any) {
        if (alive) setActorsErr(String(e?.message || "Could not load team list."));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedActor = useMemo(
    () => actors.find((a) => a.actor_id === selectedActorId) || null,
    [actors, selectedActorId]
  );

  const loadStatus = useCallback(async () => {
    if (!selectedActorId) return;
    setStatusLoading(true);
    try {
      const qs = `?target_actor_id=${encodeURIComponent(selectedActorId)}`;
      const r = await authedFetch(`/api/timeclock/status${qs}`);
      const j = await r.json();
      if (j?.ok) {
        setStatus({
          target: j.target,
          clocked_in: !!j.clocked_in,
          open_shift: j.open_shift || null,
          open_segments: Array.isArray(j.open_segments) ? j.open_segments : [],
        });
      } else {
        setStatus(null);
      }
    } catch {
      // fail-soft
    } finally {
      setStatusLoading(false);
    }
  }, [selectedActorId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Tick in-memory duration every 30s while a shift is open.
  useEffect(() => {
    if (!status?.clocked_in) return;
    const t = setInterval(() => {
      setStatus((prev) => (prev ? { ...prev } : prev));
    }, 30000);
    return () => clearInterval(t);
  }, [status?.clocked_in]);

  async function run(action: "clock-in" | "clock-out", body: Record<string, unknown> = {}) {
    setErr(null);
    setOkMsg(null);
    setBusy(action === "clock-in" ? "in" : "out");
    try {
      const r = await authedFetch(`/api/timeclock/${action}`, {
        method: "POST",
        body: JSON.stringify({ ...body, target_actor_id: selectedActorId }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || `${action} failed.`);

      if (action === "clock-in") {
        setOkMsg(`Clocked in${selectedActor && !selectedActor.is_self ? ` · ${selectedActor.display_name}` : ""}.`);
        setSelectedJobId("");
        setNote("");
      } else {
        const mins = Number(j?.duration_minutes || 0);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
        setOkMsg(`Clocked out — ${label} shift.`);
      }
      await loadStatus();
      onActivity?.();
    } catch (e: any) {
      setErr(String(e?.message || `Could not ${action}.`));
    } finally {
      setBusy(null);
    }
  }

  async function runSegment(kind: SegmentKind, action: "start" | "stop") {
    setErr(null);
    setOkMsg(null);
    setBusy(`${kind}:${action}` as BusyAction);
    try {
      const r = await authedFetch(`/api/timeclock/segment`, {
        method: "POST",
        body: JSON.stringify({ target_actor_id: selectedActorId, kind, action }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || `Could not ${action} ${kind}.`);
      const msg =
        action === "start"
          ? kind === "break"
            ? "On break."
            : kind === "lunch"
            ? "On lunch."
            : "Driving."
          : kind === "break"
          ? "Break ended."
          : kind === "lunch"
          ? "Lunch ended."
          : "Drive ended.";
      setOkMsg(msg);
      await loadStatus();
      onActivity?.();
    } catch (e: any) {
      setErr(String(e?.message || `Could not ${action} ${kind}.`));
    } finally {
      setBusy(null);
    }
  }

  const allowedActors = actors.filter((a) => a.is_allowed);
  const openShift = status?.open_shift || null;
  const openSegKinds = new Set<SegmentKind>(
    (status?.open_segments || []).map((s) => s.kind as SegmentKind)
  );

  if (actorsErr) {
    return (
      <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {actorsErr}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
            Clock in / out
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
            {selectedActor?.is_self
              ? "You"
              : selectedActor?.display_name || "Select a crew member"}
          </h2>
          {selectedActor && !selectedActor.is_self && (
            <div className="text-xs text-white/45 capitalize">{selectedActor.role}</div>
          )}
        </div>

        <div className="min-w-[180px]">
          <label className="text-[10px] uppercase tracking-widest text-white/40">
            Acting as
          </label>
          <select
            value={selectedActorId}
            onChange={(e) => setSelectedActorId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          >
            {allowedActors.map((a) => (
              <option key={a.actor_id} value={a.actor_id}>
                {a.is_self ? "Me" : a.display_name}
                {a.is_self ? "" : ` (${a.role})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status / action area */}
      <div className="mt-3">
        {statusLoading ? (
          <div className="text-sm text-white/50">Loading status…</div>
        ) : status?.clocked_in && openShift ? (
          <div
            className={[
              "rounded-xl border px-3 py-3",
              "border-emerald-500/30 bg-emerald-500/10",
            ].join(" ")}
          >
            <div className="text-xs uppercase tracking-widest text-white/40">On the clock</div>
            <div className="mt-0.5 font-semibold text-emerald-300">
              Since {fmtTime(openShift.start_at_utc)}
            </div>
            <div className="mt-0.5 text-sm text-white/70">
              {duration(openShift.start_at_utc)}
              {openShift.job_name ? ` · ${openShift.job_name}` : ""}
            </div>

            {/* Break / Lunch / Drive toggle pairs */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["break", "lunch", "drive"] as SegmentKind[]).map((kind) => {
                const isOpen = openSegKinds.has(kind);
                const openSeg = status?.open_segments?.find((s) => s.kind === kind);
                const label = kind;
                if (isOpen) {
                  return (
                    <button
                      key={kind}
                      onClick={() => runSegment(kind, "stop")}
                      disabled={busy !== null}
                      className={[
                        "rounded-xl px-3 py-2 text-xs font-semibold transition border",
                        busy !== null
                          ? "border-amber-500/20 bg-amber-500/10 text-white/40 cursor-not-allowed"
                          : "border-amber-500/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30",
                      ].join(" ")}
                    >
                      {busy === `${kind}:stop` ? "Ending…" : `End ${label}`}
                      {openSeg && (
                        <span className="ml-1 text-[10px] text-white/50">
                          · {duration(openSeg.start_at_utc)}
                        </span>
                      )}
                    </button>
                  );
                }
                return (
                  <button
                    key={kind}
                    onClick={() => runSegment(kind, "start")}
                    disabled={busy !== null}
                    className={[
                      "rounded-xl px-3 py-2 text-xs font-semibold transition border",
                      busy !== null
                        ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                        : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    {busy === `${kind}:start` ? "Starting…" : `Start ${label}`}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => run("clock-out")}
              disabled={busy !== null}
              className={[
                "mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                busy !== null
                  ? "bg-red-500/30 text-white/40 cursor-not-allowed"
                  : "bg-red-500 text-white hover:bg-red-600",
              ].join(" ")}
            >
              {busy === "out" ? "Clocking out…" : "Clock out"}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <div className="text-xs uppercase tracking-widest text-white/40">Not on the clock</div>

            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="">
                  {jobs.length === 0 ? "No active jobs" : "Select a job (optional)"}
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
              onClick={() =>
                run("clock-in", {
                  job_id: selectedJobId ? Number(selectedJobId) : undefined,
                  note: note.trim() || undefined,
                })
              }
              disabled={busy !== null || !selectedActorId}
              className={[
                "mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                busy !== null || !selectedActorId
                  ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
                  : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
              ].join(" ")}
            >
              {busy === "in" ? "Clocking in…" : "Clock in"}
            </button>
          </div>
        )}

        {err && <div className="mt-2 text-xs text-red-300">{err}</div>}
        {okMsg && <div className="mt-2 text-xs text-emerald-300">{okMsg}</div>}
      </div>
    </div>
  );
}
