"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActorOption = {
  actor_id: string;
  role: string;
  display_name: string;
  is_self: boolean;
  is_allowed: boolean;
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

/**
 * Crew mileage card for the owner portal. Lets owner/admin/board
 * log a trip for themselves OR for any allowed teammate. Backend
 * enforces the same permission matrix as the CrewClockCard.
 */
export default function CrewMileageCard({
  onActivity,
}: {
  onActivity?: () => void;
}) {
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [actorsErr, setActorsErr] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string>("");

  const [jobs, setJobs] = useState<JobOption[]>([]);

  // Form
  const [tripDate, setTripDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [distance, setDistance] = useState<string>("");
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

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

  async function submitTrip() {
    setErr(null);
    setOkMsg(null);

    const dist = Number(distance);
    if (!Number.isFinite(dist) || dist <= 0) {
      setErr("Enter a positive distance.");
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        target_actor_id: selectedActorId,
        trip_date: tripDate,
        distance: dist,
        unit,
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (selectedJobId) body.job_id = Number(selectedJobId);

      const r = await authedFetch("/api/timeclock/mileage", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Could not log trip.");

      const who = selectedActor?.is_self ? "" : ` · ${selectedActor?.display_name || ""}`;
      setOkMsg(`Logged ${dist.toFixed(1)} ${unit}${who}.`);
      setDistance("");
      setOrigin("");
      setDestination("");
      setSelectedJobId("");
      setNotes("");
      onActivity?.();
    } catch (e: any) {
      setErr(String(e?.message || "Could not log trip."));
    } finally {
      setBusy(false);
    }
  }

  if (actorsErr) {
    return (
      <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {actorsErr}
      </div>
    );
  }

  const allowedActors = actors.filter((a) => a.is_allowed);

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
            Log a trip
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

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div>
          <label className="text-xs text-white/50">Date</label>
          <input
            type="date"
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          />
        </div>
        <div>
          <label className="text-xs text-white/50">Distance</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0.0"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value === "mi" ? "mi" : "km")}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            >
              <option value="km">km</option>
              <option value="mi">mi</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50">Origin (optional)</label>
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. Shop"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
        </div>
        <div>
          <label className="text-xs text-white/50">Destination (optional)</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Job site"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-white/50">Job (optional)</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
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
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-white/50">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth noting"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
        </div>
      </div>

      {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
      {okMsg && <div className="mt-3 text-xs text-emerald-300">{okMsg}</div>}

      <button
        onClick={submitTrip}
        disabled={busy || !distance.trim() || !selectedActorId}
        className={[
          "mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
          busy || !distance.trim() || !selectedActorId
            ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
            : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
        ].join(" ")}
      >
        {busy ? "Logging…" : "Log trip"}
      </button>
    </div>
  );
}
