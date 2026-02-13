// app/app/revenue/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

type RevenueRow = {
  id?: string;
  created_at?: string;
  occurred_on?: string;
  date?: string;

  amount?: number | string;
  total?: number | string;

  source?: string;
  client?: string;
  note?: string;
  memo?: string;

  job_name?: string;
  job_id?: string;
};

function isoDay(s?: string | null) {
  const t = String(s || "").trim();
  return t ? t.slice(0, 10) : "";
}

function toMoney(n: any) {
  const x = Number(String(n ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function pickDate(x: RevenueRow) {
  return isoDay(x.date || x.occurred_on || x.created_at || "") || "—";
}

function pickDesc(x: RevenueRow) {
  return (x.source || x.client || x.note || x.memo || "").trim() || "—";
}

function pickJob(x: RevenueRow) {
  return String(x.job_name || x.job_id || "").trim() || "—";
}

function stableKey(x: RevenueRow, ix: number) {
  // Prefer DB id. If missing, use deterministic compound key.
  const d = pickDate(x);
  const a = toMoney(x.amount ?? x.total);
  const j = pickJob(x);
  const s = pickDesc(x);
  return x.id || `${d}|${a.toFixed(2)}|${j}|${s}|${ix}`;
}

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
}

type SortBy =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "desc_asc"
  | "desc_desc"
  | "job_asc"
  | "job_desc";

export default function RevenuePage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("date_desc");

  // Header sort helpers (inside component)
  function sortArrow(active: boolean, dir: "asc" | "desc") {
    if (!active) return <span className="ml-1 text-white/30">↕</span>;
    return <span className="ml-1 text-white/80">{dir === "asc" ? "▲" : "▼"}</span>;
  }

  function toggleSort(field: "date" | "amount" | "desc" | "job") {
    setSortBy((prev) => {
      const asc: SortBy =
        field === "date"
          ? "date_asc"
          : field === "amount"
          ? "amount_asc"
          : field === "job"
          ? "job_asc"
          : "desc_asc";

      const desc: SortBy =
        field === "date"
          ? "date_desc"
          : field === "amount"
          ? "amount_desc"
          : field === "job"
          ? "job_desc"
          : "desc_desc";

      if (prev === desc) return asc;
      return desc;
    });
  }

  useEffect(() => {
    document.title = "Revenue · ChiefOS";
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

        const r = await fetch(`/api/revenue/list?tenantId=${encodeURIComponent(tenantId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load revenue.");

        setRows((j.rows || []) as RevenueRow[]);
      } catch (e: any) {
        setErr(e?.message || "Failed to load revenue.");
      } finally {
        setLoading(false);
      }
    })();
  }, [gateLoading, tenantId]);

  const sorted = useMemo(() => {
    const out = (rows || []).slice();
    const cmpStr = (a: string, b: string) => String(a).localeCompare(String(b));

    out.sort((A, B) => {
      const aDate = pickDate(A);
      const bDate = pickDate(B);

      const aAmt = toMoney(A.amount ?? A.total);
      const bAmt = toMoney(B.amount ?? B.total);

      const aDesc = pickDesc(A);
      const bDesc = pickDesc(B);

      const aJob = pickJob(A);
      const bJob = pickJob(B);

      switch (sortBy) {
        case "date_asc":
          return cmpStr(aDate, bDate);
        case "date_desc":
          return cmpStr(bDate, aDate);

        case "amount_asc":
          return aAmt - bAmt;
        case "amount_desc":
          return bAmt - aAmt;

        case "desc_asc":
          return cmpStr(aDesc, bDesc);
        case "desc_desc":
          return cmpStr(bDesc, aDesc);

        case "job_asc":
          return cmpStr(aJob, bJob);
        case "job_desc":
          return cmpStr(bJob, aJob);

        default:
          return 0;
      }
    });

    return out;
  }, [rows, sortBy]);

  const totals = useMemo(() => {
    const count = sorted.length;
    const sum = sorted.reduce((acc, x) => acc + toMoney(x.amount ?? x.total), 0);
    return { count, sum };
  }, [sorted]);

  if (gateLoading || loading) {
    return <div className="p-8 text-white/70">Loading revenue…</div>;
  }

  if (err) {
    return <div className="p-8 text-red-300">Error: {err}</div>;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Ledger</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Revenue</h1>
            <p className="mt-1 text-sm text-white/60">Latest revenue entries (from transactions).</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Items</span>
              <span className="text-white">{totals.count}</span>
            </div>
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Total</span>
              <span className="text-white">${totals.sum.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No revenue entries found for this tenant.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("date_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by date"
                    >
                      Date
                      {sortArrow(sortBy.startsWith("date_"), sortBy === "date_asc" ? "asc" : "desc")}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("amount_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by amount"
                    >
                      Amount
                      {sortArrow(
                        sortBy.startsWith("amount_"),
                        sortBy === "amount_asc" ? "asc" : "desc"
                      )}
                    </button>
                  </th>

                  <th className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleSort("desc")}
                      className={[
                        "inline-flex items-center hover:text-white transition",
                        sortBy.startsWith("desc_") ? "text-white" : "text-white/60",
                      ].join(" ")}
                      title="Sort by description"
                    >
                      Description
                      {sortArrow(sortBy.startsWith("desc_"), sortBy === "desc_asc" ? "asc" : "desc")}
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
                </tr>
              </thead>

              <tbody>
                {sorted.map((x, ix) => {
                  const d = pickDate(x);
                  const amt = toMoney(x.amount ?? x.total);
                  const desc = pickDesc(x);
                  const job = pickJob(x);

                  return (
                    <tr key={stableKey(x, ix)} className="border-b border-white/5">
                      <td className="py-3 pl-4 pr-4 whitespace-nowrap text-white/85">{d}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white">${amt.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-white/75">{desc}</td>
                      <td className="py-3 pr-4 text-white/85">{job}</td>
                    </tr>
                  );
                })}

                <tr>
                  <td className="py-3 pl-4 pr-4 text-xs text-white/45">Total</td>
                  <td className="py-3 pr-4 text-sm font-semibold text-white">
                    ${totals.sum.toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
