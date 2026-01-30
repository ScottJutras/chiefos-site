"use client";

import { useEffect, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

export default function RevenuePage() {
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

        setRows(j.rows || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load revenue.");
      } finally {
        setLoading(false);
      }
    })();
  }, [gateLoading, tenantId]);

  if (gateLoading) return <div className="p-8 text-gray-600">Loading revenue…</div>;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold">Revenue</h1>
        <p className="mt-2 text-gray-600">Latest revenue entries (from transactions).</p>

        {loading && <div className="mt-6 text-sm text-gray-600">Loading…</div>}

        {err && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && !err && rows.length === 0 && (
          <div className="mt-6 rounded-lg border p-6 text-sm text-gray-600">
            No revenue entries found for this tenant.
          </div>
        )}

        {!loading && !err && rows.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Amount</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Job</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id || `${x.created_at}-${Math.random()}`} className="border-b">
                    <td className="p-3">{x.date || x.occurred_on || x.created_at || "—"}</td>
                    <td className="p-3">{x.amount ?? x.total ?? "—"}</td>
                    <td className="p-3">{x.source || x.client || x.note || x.memo || "—"}</td>
                    <td className="p-3">{x.job_name || x.job_id || "—"}</td>
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
