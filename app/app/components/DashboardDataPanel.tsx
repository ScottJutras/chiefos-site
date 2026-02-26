"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

// ✅ “effectively all” for beta (avoid accidental infinite payloads)
const MAX_ROWS = 5000;

function money(cents?: number | null) {
  const n = Number(cents ?? 0);
  const dollars = n / 100;
  return dollars.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString();
}

export default function DashboardDataPanel({ view }: { view: ViewKey }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  const title = useMemo(() => {
    switch (view) {
      case "expenses":
        return "Expenses";
      case "revenue":
        return "Revenue";
      case "time":
        return "Time";
      case "tasks":
        return "Tasks";
      default:
        return "Data";
    }
  }, [view]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setRows([]);

        // Expenses (portal view)
        if (view === "expenses") {
          const { data, error } = await supabase
            .from("chiefos_portal_expenses")
            .select("id, expense_date, vendor, description, amount_cents, job_name, job_no, created_at")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS);

          if (!alive) return;
          if (error) throw error;
          setRows(data || []);
          return;
        }

        // Revenue (try portal view first, fall back to transactions)
        if (view === "revenue") {
          try {
            const { data, error } = await supabase
              .from("chiefos_portal_revenue")
              .select("id, revenue_date, customer, description, amount_cents, job_name, created_at")
              .order("created_at", { ascending: false })
              .limit(MAX_ROWS);

            if (!alive) return;
            if (error) throw error;
            setRows(data || []);
            return;
          } catch {
            const { data, error } = await supabase
              .from("transactions")
              .select("id, date, source, description, amount_cents, job_name, created_at, kind")
              .ilike("kind", "revenue")
              .order("created_at", { ascending: false })
              .limit(MAX_ROWS);

            if (!alive) return;
            if (error) throw error;
            setRows((data || []).map((r: any) => ({ ...r, revenue_date: r.date, customer: r.source })));
            return;
          }
        }

        // Time (fail-soft)
        if (view === "time") {
          const { data, error } = await supabase
            .from("time_entries")
            .select("id, job_name, user_name, start_time, end_time, minutes, created_at, status")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS);

          if (!alive) return;
          if (error) throw error;
          setRows(data || []);
          return;
        }

        // Tasks (fail-soft)
        if (view === "tasks") {
          const { data, error } = await supabase
            .from("tasks")
            .select("id, title, status, job_name, assigned_to, created_at")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS);

          if (!alive) return;
          if (error) throw error;
          setRows(data || []);
          return;
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load data.");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [view]);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/40 p-4">
        <div>
          <div className="text-xs text-white/55">Data</div>
          <div className="mt-1 text-sm font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-xs text-white/55">
            Browse while you ask. This panel never leaves the dashboard.
          </div>
        </div>
        <div className="text-xs text-white/55">
          {loading ? "Loading…" : `${rows.length} shown${rows.length >= MAX_ROWS ? " (capped)" : ""}`}
        </div>
      </div>

      {err ? (
        <div className="p-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
            {err}
            <div className="mt-1 text-[11px] text-red-200/80">
              This panel is fail-soft. If a table/view doesn’t exist yet, we’ll wire it once the canonical surface is confirmed.
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-h-[55vh] overflow-auto p-4">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-sm text-white/60">
            Nothing to show yet.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={String(r.id)} className="rounded-xl border border-white/10 bg-black/20 p-3">
                {/* Expenses */}
                {view === "expenses" ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/85 truncate">
                        {(r.vendor || "Unknown") + (r.job_name ? ` • ${r.job_name}` : "")}
                      </div>
                      <div className="mt-1 text-xs text-white/55 truncate">
                        {fmtDate(r.expense_date || r.created_at)} • {r.description || "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-white/85">{money(r.amount_cents)}</div>
                  </div>
                ) : null}

                {/* Revenue */}
                {view === "revenue" ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/85 truncate">
                        {(r.customer || "Customer") + (r.job_name ? ` • ${r.job_name}` : "")}
                      </div>
                      <div className="mt-1 text-xs text-white/55 truncate">
                        {fmtDate(r.revenue_date || r.created_at)} • {r.description || "—"}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-white/85">{money(r.amount_cents)}</div>
                  </div>
                ) : null}

                {/* Time */}
                {view === "time" ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/85 truncate">
                        {(r.user_name || "Crew") + (r.job_name ? ` • ${r.job_name}` : "")}
                      </div>
                      <div className="mt-1 text-xs text-white/55 truncate">
                        {fmtDate(r.start_time || r.created_at)} • {r.status || "logged"}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-white/85">
                      {r.minutes != null ? `${Math.round(Number(r.minutes))}m` : "—"}
                    </div>
                  </div>
                ) : null}

                {/* Tasks */}
                {view === "tasks" ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/85 truncate">
                        {r.title || "Task"}
                        {r.job_name ? ` • ${r.job_name}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-white/55 truncate">
                        {r.status || "open"} • {fmtDate(r.created_at)}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-white/55">{r.assigned_to ? `@${r.assigned_to}` : ""}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}