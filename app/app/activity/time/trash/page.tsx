"use client";

import React, { useEffect, useMemo, useState } from "react";

type TrashRow = {
  id: string;
  date: string;        // ISO
  crew_name?: string;
  job_name?: string;
  hours?: number;
  notes?: string;
  deleted_at?: string; // ISO
};

export default function TimeTrashPage() {
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const count = rows.length;

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // ✅ Update this endpoint to your real route:
        const res = await fetch("/api/time/trash", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load trash (${res.status})`);
        const data = await res.json();
        if (!mounted) return;
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? "Failed to load trash");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  }, [rows]);

  async function restore(id: string) {
    setRestoringId(id);
    setErr(null);
    try {
      // ✅ Update this endpoint to your real restore route:
      const res = await fetch(`/api/time/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error(`Restore failed (${res.status})`);

      // remove restored row from trash list
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setErr(e?.message ?? "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-sm text-white/60">Time</div>
          <h1 className="text-xl font-semibold text-white">Trash</h1>
        </div>

        <div className="text-sm text-white/70">
          {loading ? "Loading…" : `${count} deleted`}
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-white/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Deleted</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Crew</th>
              <th className="px-4 py-3 text-left font-medium">Job</th>
              <th className="px-4 py-3 text-right font-medium">Hours</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>

          <tbody className="text-white/85">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-white/60" colSpan={6}>
                  Loading deleted entries…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-white/60" colSpan={6}>
                  Trash is empty.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-4 py-3 text-white/60">
                    {r.deleted_at ? new Date(r.deleted_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.date ? new Date(r.date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">{r.crew_name ?? "—"}</td>
                  <td className="px-4 py-3">{r.job_name ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {typeof r.hours === "number" ? r.hours.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/15 disabled:opacity-50"
                      disabled={restoringId === r.id}
                      onClick={() => restore(r.id)}
                    >
                      {restoringId === r.id ? "Restoring…" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-white/50">
        Restored entries return to your Time ledger.
      </div>
    </div>
  );
}
