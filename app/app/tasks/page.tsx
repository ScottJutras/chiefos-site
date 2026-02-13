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

type SortBy =
  | "created_desc"
  | "created_asc"
  | "status_asc"
  | "status_desc"
  | "title_asc"
  | "title_desc"
  | "assignee_asc"
  | "assignee_desc";

export default function TasksPage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("created_desc");

  // Header sort helpers (inside component)
  function sortArrow(active: boolean, dir: "asc" | "desc") {
    if (!active) return <span className="ml-1 text-white/30">↕</span>;
    return <span className="ml-1 text-white/80">{dir === "asc" ? "▲" : "▼"}</span>;
  }

  function toggleSort(field: "created" | "status" | "title" | "assignee") {
    setSortBy((prev) => {
      const asc: SortBy =
        field === "created"
          ? "created_asc"
          : field === "status"
          ? "status_asc"
          : field === "title"
          ? "title_asc"
          : "assignee_asc";

      const desc: SortBy =
        field === "created"
          ? "created_desc"
          : field === "status"
          ? "status_desc"
          : field === "title"
          ? "title_desc"
          : "assignee_desc";

      if (prev === desc) return asc;
      return desc;
    });
  }

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
    const cmpStr = (a: string, b: string) => String(a).localeCompare(String(b));

    out.sort((A, B) => {
      const aC = pickCreated(A);
      const bC = pickCreated(B);
      const aS = pickStatus(A);
      const bS = pickStatus(B);
      const aT = pickTitle(A);
      const bT = pickTitle(B);
      const aA = pickAssignee(A);
      const bA = pickAssignee(B);

      switch (sortBy) {
        case "created_asc":
          return cmpStr(aC, bC);
        case "created_desc":
          return cmpStr(bC, aC);

        case "status_asc":
          return cmpStr(aS, bS);
        case "status_desc":
          return cmpStr(bS, aS);

        case "title_asc":
          return cmpStr(aT, bT);
        case "title_desc":
          return cmpStr(bT, aT);

        case "assignee_asc":
          return cmpStr(aA, bA);
        case "assignee_desc":
          return cmpStr(bA, aA);

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
                  <th className="py-3 pl-4 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("status_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by status"
                    >
                      Status
                      {sortArrow(
                        sortBy.startsWith("status_"),
                        sortBy === "status_asc" ? "asc" : "desc"
                      )}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("title")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("title_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by title"
                    >
                      Title
                      {sortArrow(
                        sortBy.startsWith("title_"),
                        sortBy === "title_asc" ? "asc" : "desc"
                      )}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("assignee")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("assignee_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by assignee"
                    >
                      Assignee
                      {sortArrow(
                        sortBy.startsWith("assignee_"),
                        sortBy === "assignee_asc" ? "asc" : "desc"
                      )}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("created")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("created_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by created time"
                    >
                      Created
                      {sortArrow(
                        sortBy.startsWith("created_"),
                        sortBy === "created_asc" ? "asc" : "desc"
                      )}
                    </button>
                  </th>
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
