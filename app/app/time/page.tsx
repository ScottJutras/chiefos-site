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

  created_at: string | null; // timestamp without tz in your dump (keep as string)
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

// Supabase wants timestamp without tz as "YYYY-MM-DD HH:MM:SS"
function toPgTimestampNoTz(dtLocal: string) {
  // dtLocal from <input type="datetime-local"> is "YYYY-MM-DDTHH:MM"
  const t = String(dtLocal || "").trim();
  if (!t) return null;
  return t.replace("T", " ") + ":00";
}

function toInputDateTimeLocal(s?: string | null) {
  // s is "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const t = String(s || "").trim();
  if (!t) return "";
  // normalize to "YYYY-MM-DDTHH:MM"
  const x = t.replace(" ", "T");
  return x.slice(0, 16);
}

export default function TimePage() {
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: true });
  const toast = useToast();

  const [rows, setRows] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

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

 useEffect(() => {
    document.title = "Time Clock · ChiefOS";
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

    return rows.filter((r) => {
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

      // We update BOTH timestamp + local_time to keep your existing pattern consistent.
      // (Later, if you want true TZ math, we can compute local_time from tz.)
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

  if (gateLoading || loading) return <div className="p-8 text-gray-600">Loading time…</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Time</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review, edit, and soft-delete time events (clock, break, lunch, drive).
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 rounded-lg border p-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Employee, type, job, date, address…"
              />
            </div>

            <div className="min-w-[220px]">
              <label className="block text-xs text-gray-600 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
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
        {filtered.length === 0 ? (
          <p className="mt-12 text-gray-600">No time entries found.</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-left text-sm text-gray-600">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">TZ</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b text-sm">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {toInputDateTimeLocal(r.local_time || r.timestamp) ? (
                        <>
                          <div className="font-medium">{isoDay(r.local_time || r.timestamp)}</div>
                          <div className="text-xs text-gray-500">
                            {(r.local_time || r.timestamp || "").slice(11, 19)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">{r.employee_name ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{r.type ?? "—"}</td>
                    <td className="py-2 pr-4">{r.job_name ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{r.tz ?? "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {r.source_msg_id ? "WhatsApp" : "—"}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <button
                        onClick={() => openEdit(r)}
                        disabled={busyId === r.id}
                        className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => softDelete(r.id)}
                        disabled={busyId === r.id}
                        className="ml-2 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit modal */}
        {editOpen && draft && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-lg bg-white border p-4">
              <div className="text-sm font-semibold">Edit time entry</div>
              <div className="mt-1 text-xs text-gray-500">
                This edits the recorded event time. (Clock/break/lunch/drive are all events.)
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft((d) => (d ? { ...d, type: e.target.value } : d))}
                    className="w-full rounded-md border px-3 py-2 text-sm bg-white"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {/* In case you have other types in DB */}
                    {!TYPE_OPTIONS.includes(draft.type) && (
                      <option value={draft.type}>{draft.type}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Event time</label>
                  <input
                    type="datetime-local"
                    value={draft.dtLocal}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, dtLocal: e.target.value } : d))
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Job name (optional)</label>
                  <input
                    value={draft.job_name}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, job_name: e.target.value } : d))
                    }
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="e.g. Medway Park"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Employee</label>
                  <input
                    value={draft.employee_name}
                    readOnly
                    className="w-full rounded-md border px-3 py-2 text-sm bg-gray-50 text-gray-700"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setEditOpen(false);
                    setDraft(null);
                  }}
                  disabled={busyId === draft.id}
                >
                  Cancel
                </button>

                <button
                  className="rounded-md bg-black text-white px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
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
