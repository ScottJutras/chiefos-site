// app/app/time/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import { useToast } from "@/app/components/Toast";

type TimeEntry = {
  id: number;
  tenant_id: string | null;
  employee_user_id: string | null;

  owner_id: string | null; // legacy (phone)
  user_id: string | null; // legacy (phone)
  employee_name: string | null;

  type: string | null; // clock_in, clock_out, break_start, lunch_start, etc.
  job_name: string | null;

  timestamp: string | null; // timestamp without tz
  local_time: string | null; // timestamp without tz
  tz: string | null;

  lat: number | null;
  lng: number | null;
  address: string | null;

  source_msg_id: string | null;

  created_at: string | null;
  deleted_at: string | null; // timestamptz
};

const TYPE_OPTIONS = [
  "clock_in",
  "clock_out",
  "break_start",
  "break_stop",
  "lunch_start",
  "lunch_end",
  "drive_start",
  "drive_stop",
];

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function isoTime(s?: string | null) {
  const t = String(s || "").trim();
  if (!t) return "";
  // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const x = t.replace("T", " ");
  return x.slice(11, 19);
}

// Supabase wants timestamp without tz as "YYYY-MM-DD HH:MM:SS"
function toPgTimestampNoTz(dtLocal: string) {
  const t = String(dtLocal || "").trim(); // "YYYY-MM-DDTHH:MM"
  if (!t) return null;
  return t.replace("T", " ") + ":00";
}

function toInputDateTimeLocal(s?: string | null) {
  const t = String(s || "").trim();
  if (!t) return "";
  const x = t.replace(" ", "T");
  return x.slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

type SortBy =
  | "time_desc"
  | "time_asc"
  | "employee_asc"
  | "employee_desc"
  | "type_asc"
  | "type_desc"
  | "job_asc"
  | "job_desc";

export default function TimePage() {
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: true });
  const toast = useToast();

  const [rows, setRows] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // View
  const [sortBy, setSortBy] = useState<SortBy>("time_desc");

  // Busy states
  const [busyId, setBusyId] = useState<number | null>(null);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<{
    id: number;
    type: string;
    employee_name: string;
    job_name: string;
    tz: string;
    dtLocal: string; // datetime-local value
  } | null>(null);

  // Header sort helpers (inside component)
  function sortArrow(active: boolean, dir: "asc" | "desc") {
    if (!active) return <span className="ml-1 text-white/30">↕</span>;
    return <span className="ml-1 text-white/80">{dir === "asc" ? "▲" : "▼"}</span>;
  }

  function toggleSort(field: "time" | "employee" | "type" | "job") {
    setSortBy((prev) => {
      const asc: SortBy =
        field === "time"
          ? "time_asc"
          : field === "employee"
          ? "employee_asc"
          : field === "type"
          ? "type_asc"
          : "job_asc";

      const desc: SortBy =
        field === "time"
          ? "time_desc"
          : field === "employee"
          ? "employee_desc"
          : field === "type"
          ? "type_desc"
          : "job_desc";

      if (prev === desc) return asc;
      return desc;
    });
  }

  useEffect(() => {
    document.title = "Time · ChiefOS";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const { data, error } = await supabase
          .from("time_entries")
          .select("*")
          .is("deleted_at", null)
          .order("timestamp", { ascending: false });

        if (error) throw error;
        if (!cancelled) setRows((data ?? []) as TimeEntry[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load time entries.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return (rows || []).filter((r) => {
      if (typeFilter !== "all" && String(r.type || "") !== typeFilter) return false;
      if (!qq) return true;

      const hay = [
        r.employee_name ?? "",
        r.type ?? "",
        r.job_name ?? "",
        r.tz ?? "",
        r.timestamp ?? "",
        r.local_time ?? "",
        r.address ?? "",
        r.user_id ?? "",
        r.owner_id ?? "",
        r.source_msg_id ?? "",
        String(r.id ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [rows, q, typeFilter]);

  const sorted = useMemo(() => {
    const out = filtered.slice();
    const cmpStr = (a: string, b: string) => a.localeCompare(b);

    out.sort((A, B) => {
      const aBase = A.local_time || A.timestamp || "";
      const bBase = B.local_time || B.timestamp || "";
      const aT = String(aBase).replace("T", " ");
      const bT = String(bBase).replace("T", " ");

      const aEmp = String(A.employee_name || "—").trim();
      const bEmp = String(B.employee_name || "—").trim();

      const aType = String(A.type || "—").trim();
      const bType = String(B.type || "—").trim();

      const aJob = String(A.job_name || "—").trim();
      const bJob = String(B.job_name || "—").trim();

      switch (sortBy) {
        case "time_asc":
          return cmpStr(aT, bT);
        case "time_desc":
          return cmpStr(bT, aT);

        case "employee_asc":
          return cmpStr(aEmp, bEmp);
        case "employee_desc":
          return cmpStr(bEmp, aEmp);

        case "type_asc":
          return cmpStr(aType, bType);
        case "type_desc":
          return cmpStr(bType, aType);

        case "job_asc":
          return cmpStr(aJob, bJob);
        case "job_desc":
          return cmpStr(bJob, aJob);

        default:
          return 0;
      }
    });

    return out;
  }, [filtered, sortBy]);

  const totals = useMemo(() => ({ count: sorted.length }), [sorted]);

  function openEdit(r: TimeEntry) {
    const base = r.local_time || r.timestamp || "";
    setDraft({
      id: r.id,
      type: String(r.type || ""),
      employee_name: String(r.employee_name || ""),
      job_name: String(r.job_name || ""),
      tz: String(r.tz || ""),
      dtLocal: toInputDateTimeLocal(base),
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!draft) return;

    const ts = toPgTimestampNoTz(draft.dtLocal);
    if (!ts) {
      toast.push({ kind: "error", message: "Please choose a date/time." });
      return;
    }

    try {
      setBusyId(draft.id);

      // Update BOTH timestamp + local_time to preserve your current data model.
      const patch: Partial<TimeEntry> = {
        timestamp: ts,
        local_time: ts,
        job_name: draft.job_name.trim() || null,
        type: draft.type.trim() || null,
      };

      const { error } = await supabase.from("time_entries").update(patch).eq("id", draft.id);
      if (error) throw error;

      setRows((prev) =>
        prev.map((r) => (r.id === draft.id ? ({ ...r, ...patch } as TimeEntry) : r))
      );

      toast.push({ kind: "success", message: "Time entry updated." });
      setEditOpen(false);
      setDraft(null);
    } catch (e: any) {
      toast.push({ kind: "error", message: e?.message ?? "Update failed." });
    } finally {
      setBusyId(null);
    }
  }

  async function softDelete(id: number) {
    if (!confirm("Move this time entry to trash?")) return;

    try {
      setBusyId(id);

      const { error } = await supabase
        .from("time_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.push({ kind: "success", message: "Time entry deleted (soft)." });
    } catch (e: any) {
      toast.push({ kind: "error", message: e?.message ?? "Delete failed." });
    } finally {
      setBusyId(null);
    }
  }

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading time…</div>;
  if (error) return <div className="p-8 text-red-300">Error: {error}</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Ledger</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Time</h1>
            <p className="mt-1 text-sm text-white/60">
              Review, edit, and soft-delete time events (clock, break, lunch, drive).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Items</span>
              <span className="text-white">{totals.count}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs text-white/60 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                placeholder="Employee, type, job, date, address…"
              />
            </div>

            <div className="min-w-[220px]">
              <label className="block text-xs text-white/60 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
              >
                <option value="all">All</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No time entries found.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("time")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("time_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by time"
                    >
                      When
                      {sortArrow(sortBy.startsWith("time_"), sortBy === "time_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("employee")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("employee_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by employee"
                    >
                      Employee
                      {sortArrow(
                        sortBy.startsWith("employee_"),
                        sortBy === "employee_asc" ? "asc" : "desc"
                      )}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("type")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("type_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by type"
                    >
                      Type
                      {sortArrow(sortBy.startsWith("type_"), sortBy === "type_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("job")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("job_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by job"
                    >
                      Job
                      {sortArrow(sortBy.startsWith("job_"), sortBy === "job_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">TZ</th>
                  <th className="py-3 pr-4">Source</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((r) => {
                  const base = r.local_time || r.timestamp || "";
                  const day = isoDay(base);
                  const time = isoTime(base);

                  return (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="py-3 pl-4 pr-4 whitespace-nowrap">
                        {day ? (
                          <>
                            <div className="font-medium text-white/90">{day}</div>
                            <div className="text-xs text-white/45">{time || "—"}</div>
                          </>
                        ) : (
                          <span className="text-white/60">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-white/85">{r.employee_name ?? "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/85">{r.type ?? "—"}</td>
                      <td className="py-3 pr-4 text-white/75">{r.job_name ?? "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/60">{r.tz ?? "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/60">
                        {r.source_msg_id ? "WhatsApp" : "—"}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(r)}
                          disabled={busyId === r.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => softDelete(r.id)}
                          disabled={busyId === r.id}
                          className="ml-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit modal */}
        {editOpen && draft && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B0B0E] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/90">Edit time entry</div>
                  <div className="mt-1 text-xs text-white/50">
                    This edits the recorded event time. (Clock/break/lunch/drive are all events.)
                  </div>
                </div>

                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                  onClick={() => {
                    setEditOpen(false);
                    setDraft(null);
                  }}
                  disabled={busyId === draft.id}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Type</label>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft((d) => (d ? { ...d, type: e.target.value } : d))}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {!TYPE_OPTIONS.includes(draft.type) && <option value={draft.type}>{draft.type}</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Event time</label>
                  <input
                    type="datetime-local"
                    value={draft.dtLocal}
                    onChange={(e) => setDraft((d) => (d ? { ...d, dtLocal: e.target.value } : d))}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-white/60 mb-1">Job name (optional)</label>
                  <input
                    value={draft.job_name}
                    onChange={(e) => setDraft((d) => (d ? { ...d, job_name: e.target.value } : d))}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                    placeholder="e.g. Medway Park"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-white/60 mb-1">Employee</label>
                  <input
                    value={draft.employee_name}
                    readOnly
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                  onClick={() => {
                    setEditOpen(false);
                    setDraft(null);
                  }}
                  disabled={busyId === draft.id}
                >
                  Cancel
                </button>

                <button
                  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                  onClick={saveEdit}
                  disabled={busyId === draft.id}
                >
                  {busyId === draft.id ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
