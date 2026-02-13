// app/app/tasks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

type TaskRow = {
  id?: string;
  created_at?: string;

  status?: string;
  state?: string;

  title?: string;
  name?: string;
  task?: string;

  assigned_to?: string;
  assignee?: string;
  user_id?: string;
};

function pickStatus(x: TaskRow) {
  return String(x.status || x.state || "").trim() || "—";
}

function pickTitle(x: TaskRow) {
  return String(x.title || x.name || x.task || "").trim() || "—";
}

function pickAssignee(x: TaskRow) {
  return String(x.assigned_to || x.assignee || x.user_id || "").trim() || "—";
}

function pickCreated(x: TaskRow) {
  const t = String(x.created_at || "").trim();
  return t ? t.slice(0, 19).replace("T", " ") : "—";
}

function stableKey(x: TaskRow, ix: number) {
  return x.id || `${pickCreated(x)}|${pickStatus(x)}|${pickTitle(x)}|${pickAssignee(x)}|${ix}`;
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

type SortBy = "created_desc" | "created_asc" | "status_asc" | "status_desc";

export default function TasksPage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("created_desc");

  useEffect(() => {
    document.title = "Tasks · ChiefOS";
  }, []);

  useEffect(() => {
    (async () => {
      if (gateLoading) return;
      if (!tenantId) return;

      setErr(null);
      setLoading(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) throw new Error("Missing session token.");

        const r = await fetch(`/api/tasks/list?tenantId=${encodeURIComponent(tenantId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load tasks.");

        setRows((j.rows || []) as TaskRow[]);
      } catch (e: any) {
        setErr(e?.message || "Failed to load tasks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [gateLoading, tenantId]);

  const sorted = useMemo(() => {
    const out = (rows || []).slice();

    const cmpStr = (a: string, b: string) => a.localeCompare(b);

    out.sort((A, B) => {
      const aC = pickCreated(A);
      const bC = pickCreated(B);
      const aS = pickStatus(A);
      const bS = pickStatus(B);

      switch (sortBy) {
        case "created_asc":
          return cmpStr(aC, bC);
        case "created_desc":
          return cmpStr(bC, aC);
        case "status_asc":
          return cmpStr(aS, bS);
        case "status_desc":
          return cmpStr(bS, aS);
        default:
          return 0;
      }
    });

    return out;
  }, [rows, sortBy]);

  const totals = useMemo(() => ({ count: sorted.length }), [sorted]);

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading tasks…</div>;
  if (err) return <div className="p-8 text-red-300">Error: {err}</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Ledger</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="mt-1 text-sm text-white/60">Latest tasks.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Items</span>
              <span className="text-white">{totals.count}</span>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/15"
            >
              <option value="created_desc">Created (newest)</option>
              <option value="created_asc">Created (oldest)</option>
              <option value="status_asc">Status (A → Z)</option>
              <option value="status_desc">Status (Z → A)</option>
            </select>
          </div>
        </div>

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No tasks found for this tenant.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4">Status</th>
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Assignee</th>
                  <th className="py-3 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((x, ix) => (
                  <tr key={stableKey(x, ix)} className="border-b border-white/5">
                    <td className="py-3 pl-4 pr-4 whitespace-nowrap text-white/85">
                      {pickStatus(x)}
                    </td>
                    <td className="py-3 pr-4 text-white/80">{pickTitle(x)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/60">
                      {pickAssignee(x)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap text-white/60">
                      {pickCreated(x)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
