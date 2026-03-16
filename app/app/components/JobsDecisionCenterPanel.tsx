"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type JobRow = {
  id: number;
  job_no: number | null;
  job_name: string | null;
  name?: string | null;
  status: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type StatusKey = "active" | "paused" | "closed" | "other";

function normalizeStatus(raw?: string | null, active?: boolean | null): StatusKey {
  const s = String(raw || "").trim().toLowerCase();

  if (active || s === "active" || s === "open" || s.includes("active")) return "active";
  if (s.includes("pause") || s.includes("hold")) return "paused";
  if (s.includes("closed") || s.includes("done") || s.includes("complete")) return "closed";
  return "other";
}

function statusTone(status: StatusKey) {
  switch (status) {
    case "active":
      return "bg-emerald-400";
    case "paused":
      return "bg-amber-400";
    case "closed":
      return "bg-white/35";
    default:
      return "bg-white/20";
  }
}

function statusLabel(status: StatusKey) {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "closed":
      return "Closed";
    default:
      return "Other";
  }
}

function formatDate(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export default function JobsDecisionCenterPanel(props: {
  selectedJobId?: number | null;
  onSelectJob?: (job: JobRow) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("jobs")
          .select("id, job_no, job_name, name, status, active, created_at, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1000);

        if (!alive) return;

        if (error) {
          setErr(error.message);
          setJobs([]);
          return;
        }

        setJobs((data as JobRow[]) || []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load jobs.");
        setJobs([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const out = {
      all: jobs.length,
      active: 0,
      paused: 0,
      closed: 0,
      other: 0,
    };

    for (const job of jobs) {
      const key = normalizeStatus(job.status, job.active);
      out[key] += 1;
    }

    return out;
  }, [jobs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let rows = jobs.filter((job) => {
      const title = String(job.job_name || job.name || "").toLowerCase();
      const no = String(job.job_no || "").toLowerCase();
      const st = String(job.status || "").toLowerCase();
      const normalized = normalizeStatus(job.status, job.active);

      const matchesText =
        !needle || title.includes(needle) || no.includes(needle) || st.includes(needle);

      const matchesStatus = statusFilter === "all" || normalized === statusFilter;

      return matchesText && matchesStatus;
    });

    rows = rows.sort((a, b) => {
      const sa = normalizeStatus(a.status, a.active);
      const sb = normalizeStatus(b.status, b.active);

      const rank = (s: StatusKey) => {
        if (s === "active") return 0;
        if (s === "paused") return 1;
        if (s === "other") return 2;
        return 3;
      };

      const ra = rank(sa);
      const rb = rank(sb);
      if (ra !== rb) return ra - rb;

      const ad = new Date(a.updated_at || a.created_at || 0).getTime();
      const bd = new Date(b.updated_at || b.created_at || 0).getTime();
      return bd - ad;
    });

    return rows;
  }, [jobs, q, statusFilter]);

  return (
    <div className="flex h-full min-h-[84vh] flex-col bg-black">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Jobs</div>
            <div className="mt-1 text-lg font-semibold text-white/92">Operating center</div>
            <div className="mt-1 text-sm text-white/55">
              Start with the job. Then inspect what belongs to it.
            </div>
          </div>

          <Link
            href="/app/jobs/new"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
          >
            Create job
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Active</div>
              <div className="mt-1 text-lg font-semibold text-white/95">{counts.active}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">Total</div>
              <div className="mt-1 text-lg font-semibold text-white/95">{counts.all}</div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jobs by name, number, or status"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "active", "paused", "closed", "other"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium transition border",
                statusFilter === key
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              ].join(" ")}
            >
              {key === "all"
                ? `All (${counts.all})`
                : key === "active"
                ? `Active (${counts.active})`
                : key === "paused"
                ? `Paused (${counts.paused})`
                : key === "closed"
                ? `Closed (${counts.closed})`
                : `Other (${counts.other})`}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-4 text-sm text-white/60">Loading jobs…</div>
        ) : err ? (
          <div className="px-4 py-4 text-sm text-red-200">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/55">No jobs found.</div>
        ) : (
          <div>
            {filtered.map((job) => {
              const normalized = normalizeStatus(job.status, job.active);
              const selected =
                props.selectedJobId != null && Number(props.selectedJobId) === Number(job.id);
              const title = String(job.job_name || job.name || "Untitled job");
              const updated = formatDate(job.updated_at || job.created_at || null);

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => props.onSelectJob?.(job)}
                  className={[
                    "flex w-full items-start justify-between gap-3 border-b border-white/6 px-4 py-3 text-left transition",
                    selected
                      ? "bg-white/10 ring-1 ring-inset ring-white/10"
                      : "hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={["h-2 w-2 rounded-full", statusTone(normalized)].join(" ")} />
                      <div className="truncate text-sm font-semibold text-white/92">{title}</div>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                      <span>{job.job_no ? `#${job.job_no}` : "No number"}</span>
                      <span>•</span>
                      <span>{statusLabel(normalized)}</span>
                      {updated ? (
                        <>
                          <span>•</span>
                          <span>{updated}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-[11px] text-white/35">
                    {selected ? "Selected" : "Open"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}