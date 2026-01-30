"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTenantGate } from "@/lib/useTenantGate";

    useEffect(() => {
    document.title = "Audit · ChiefOS";
  }, []);
  
type AuditRow = {
  id: string;
  expense_id: string;
  actor_user_id: string | null;
  action: string;
  batch_id: string | null;
  before_row: any;
  after_row: any;
  created_at: string;
};

function iso(s?: string | null) {
  const t = String(s || "").trim();
  return t ? new Date(t).toLocaleString() : "—";
}

function safeStr(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function diffKeys(before: any, after: any) {
  const b = before && typeof before === "object" ? before : {};
  const a = after && typeof after === "object" ? after : {};
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)]);

  const changes: { key: string; from: string; to: string }[] = [];
  for (const k of Array.from(keys)) {
    // Skip noisy fields
    if (k === "updated_at") continue;

    const from = safeStr(b[k]);
    const to = safeStr(a[k]);
    if (from !== to) changes.push({ key: k, from, to });
  }
  return changes;
}

export default function ExpensesAuditPage() {
  const router = useRouter();
  const { loading: gateLoading, userId } = useTenantGate({ requireWhatsApp: true });

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<string>("all");
  const [fromTs, setFromTs] = useState<string>("");
  const [toTs, setToTs] = useState<string>("");
  const [q, setQ] = useState<string>("");

  // ✅ NEW: keep current viewer id so we can label “You”
  const [viewerUserId, setViewerUserId] = useState<string>("");

 

  useEffect(() => {
    let cancelled = false;

    async function gateAndLoad() {
  try {
    // Gate already handled by useTenantGate
    if (!userId) return;

    if (!cancelled) setViewerUserId(userId);

    const { data, error } = await supabase.rpc("chiefos_list_expense_audit", {
      p_limit: 500,
      p_offset: 0,
      p_action: action === "all" ? null : action,
      p_expense_id: null,
      p_from: fromTs ? new Date(fromTs).toISOString() : null,
      p_to: toTs ? new Date(toTs).toISOString() : null,
    });

    if (error) throw error;
    if (!cancelled) setRows((data ?? []) as AuditRow[]);
  } catch (e: any) {
    if (!cancelled) setError(e?.message ?? "Failed to load audit.");
  } finally {
    if (!cancelled) setLoading(false);
  }
}


    setLoading(true);
    gateAndLoad();
    return () => {
      cancelled = true;
    };
  }, [router, action, fromTs, toTs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;

    return rows.filter((r) => {
      const hay = [
        r.action,
        r.expense_id,
        r.actor_user_id ?? "",
        safeStr(r.before_row),
        safeStr(r.after_row),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [rows, q]);

  if (gateLoading || loading) return <div className="p-8 text-gray-600">Loading audit…</div>;
if (error) return <div className="p-8 text-red-600">Error: {error}</div>;


  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Expense Audit</h1>
            <p className="mt-1 text-sm text-gray-500">
              Who changed what, when — with field-level diffs.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push("/app/expenses")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back to Expenses
            </button>
            <button
              onClick={() => router.push("/app/expenses/trash")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Trash
            </button>
            <button
              onClick={() => router.push("/app/expenses/vendors")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Vendors
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-lg border p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="action, expense_id, actor, field values…"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              >
                <option value="all">All</option>
                <option value="edit">edit</option>
                <option value="bulk_assign_job">bulk_assign_job</option>
                <option value="delete">delete</option>
                <option value="undo_delete">undo_delete</option>
                <option value="restore">restore</option>
                <option value="vendor_normalize">vendor_normalize</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">From</label>
              <input
                type="datetime-local"
                value={fromTs}
                onChange={(e) => setFromTs(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">To</label>
              <input
                type="datetime-local"
                value={toTs}
                onChange={(e) => setToTs(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 text-gray-600">No audit entries match your filters.</p>
        ) : (
          <div className="mt-8 space-y-4">
            {filtered.map((r) => {
              const changes = diffKeys(r.before_row, r.after_row);

              const isYou =
                !!viewerUserId && !!r.actor_user_id && r.actor_user_id === viewerUserId;

              return (
                <div key={r.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <span className="font-semibold">{r.action}</span>{" "}
                      <span className="text-gray-500">•</span>{" "}
                      <span className="text-gray-600">{iso(r.created_at)}</span>
                    </div>

                    <div className="text-xs text-gray-500">
                      expense_id: <span className="font-mono">{r.expense_id}</span>

                      {r.actor_user_id ? (
                        <>
                          {" "}
                          • actor:{" "}
                          <span className="font-mono">{r.actor_user_id}</span>
                          {isYou ? (
                            <span className="ml-2 rounded-full border px-2 py-0.5 text-[11px] text-gray-700">
                              You
                            </span>
                          ) : null}
                        </>
                      ) : null}

                      {r.batch_id ? (
                        <>
                          {" "}
                          • batch: <span className="font-mono">{r.batch_id}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {changes.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-600">
                      No field-level differences detected.
                    </div>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="border-b text-left text-xs text-gray-600">
                            <th className="py-2 pr-4">Field</th>
                            <th className="py-2 pr-4">Before</th>
                            <th className="py-2">After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((c) => (
                            <tr key={c.key} className="border-b text-sm">
                              <td className="py-2 pr-4 font-mono text-xs">{c.key}</td>
                              <td className="py-2 pr-4 text-gray-700 whitespace-pre-wrap">
                                {c.from || "—"}
                              </td>
                              <td className="py-2 text-gray-900 whitespace-pre-wrap">
                                {c.to || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
