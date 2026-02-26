"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type JobRow = {
  id: number; // serial
  job_no: number;
  job_name: string;
  status: string;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type StatusKey = "active" | "paused" | "cancelled" | "closed" | "unknown";

function normalizeStatus(raw?: string | null): StatusKey {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s === "active" || s === "open" || s.includes("active")) return "active";
  if (s.includes("pause") || s.includes("hold")) return "paused";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("close") || s.includes("done") || s.includes("complete")) return "closed";
  return "unknown";
}

function statusLabel(k: StatusKey) {
  switch (k) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    case "closed":
      return "Closed";
    default:
      return "Other";
  }
}

function statusBadgeClass(k: StatusKey) {
  // Dark portal styling
  switch (k) {
    case "active":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "paused":
      return "border-amber-400/20 bg-amber-500/10 text-amber-200";
    case "cancelled":
      return "border-white/10 bg-white/5 text-white/60";
    case "closed":
      return "border-sky-400/20 bg-sky-500/10 text-sky-200";
    default:
      return "border-white/10 bg-white/5 text-white/60";
  }
}

export default function JobsDecisionCenterPanel(props: {
  title?: string;
  href?: string; // optional "Open Jobs" link
  maxHeightClassName?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<StatusKey, boolean>>({
    active: true,
    paused: false,
    cancelled: false,
    closed: false,
    unknown: false,
  });

  const maxH = props.maxHeightClassName ?? "max-h-[70vh]";

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("jobs")
          .select("id, job_no, job_name, status, active, created_at, updated_at")
          .order("job_no", { ascending: true });

        if (!alive) return;

        if (error) {
          setErr(error.message);
          setJobs([]);
        } else {
          setJobs((data as JobRow[]) || []);
        }
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return jobs;

    return jobs.filter((j) => {
      const no = String(j.job_no ?? "").toLowerCase();
      const name = (j.job_name || "").toLowerCase();
      const st = (j.status || "").toLowerCase();
      return no.includes(needle) || name.includes(needle) || st.includes(needle);
    });
  }, [jobs, q]);

  const grouped = useMemo(() => {
    const g: Record<StatusKey, JobRow[]> = {
      active: [],
      paused: [],
      cancelled: [],
      closed: [],
      unknown: [],
    };
    for (const j of filtered) g[normalizeStatus(j.status)].push(j);
    return g;
  }, [filtered]);

  const totalCount = jobs.length;
  const visibleCount = filtered.length;

  return (
    <aside className="rounded-2xl border border-white/10 bg-black/30">
      {/* Header */}
      <div className="sticky top-0 z-10 rounded-t-2xl border-b border-white/10 bg-black/60 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/55">Decision Center</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-sm font-semibold text-white/90">
                {props.title || "Jobs"}
              </div>

              {props.href ? (
                <Link
                  href={props.href}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/75 hover:bg-white/10 transition"
                >
                  Open Jobs →
                </Link>
              ) : null}
            </div>

            <div className="mt-1 text-xs text-white/55">
              Search + expand groups without leaving the dashboard.
            </div>
          </div>

          <div className="text-right text-xs text-white/55">
            <div>{loading ? "Loading…" : `${visibleCount}/${totalCount}`}</div>
            <div>visible</div>
          </div>
        </div>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by job #, name, or status"
            className={[
              "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm",
              "text-white/85 placeholder:text-white/35 outline-none",
              "focus:border-white/20",
            ].join(" ")}
          />
        </div>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
            {err}
            <div className="mt-1 text-[11px] text-red-200/80">
              If this is permissions-related, confirm: portal membership → tenant mapping → jobs RLS.
            </div>
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className={`${maxH} overflow-auto p-4`}>
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Loading jobs…
          </div>
        ) : totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-sm text-white/60">
            No jobs yet. Create one to unlock job-first totals (profit, spend, revenue).
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(grouped) as StatusKey[]).map((k) => {
              const list = grouped[k];
              if (!list.length) return null;

              const isOpen = open[k];

              return (
                <div key={k} className="rounded-2xl border border-white/10 bg-black/20">
                  <button
                    type="button"
                    onClick={() => setOpen((s) => ({ ...s, [k]: !s[k] }))}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-[11px] font-semibold",
                          statusBadgeClass(k),
                        ].join(" ")}
                      >
                        {statusLabel(k)}
                      </span>
                      <span className="text-sm font-semibold text-white/85">{list.length}</span>
                      <span className="text-xs text-white/55">jobs</span>
                    </div>
                    <span className="text-xs text-white/55">{isOpen ? "Collapse" : "Expand"}</span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-white/10 p-3">
                      <div className="space-y-2">
                        {list.map((j) => (
                          <div
                            key={j.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                                  #{j.job_no}
                                </span>
                                <div className="truncate text-sm font-semibold text-white/85">
                                  {j.job_name || "Untitled job"}
                                </div>
                              </div>
                              <div className="mt-0.5 text-xs text-white/55">
                                Status: {j.status || "unknown"}
                              </div>
                            </div>

                            {/* Read-only: no fake buttons */}
                            <div className="shrink-0 text-[11px] text-white/45">
                              {j.active ? "Active" : ""}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 text-[11px] text-white/45">
                        Rule: calm truth surface. No mutation, no “dashboard theatre.”
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}