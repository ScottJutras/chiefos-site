"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTenantGate } from "@/lib/useTenantGate";

type VendorRow = {
  vendor: string;
  count: number;
  total_amount: number;
};

function money(n: any) {
  const x = Number(n || 0);
  return `$${x.toFixed(2)}`;
}

export default function VendorsPage() {
  const router = useRouter();
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: true });

  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const [canonical, setCanonical] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push("/login");
        return;
      }

     

      const { data: pu } = await supabase
        .from("chiefos_portal_users")
        .select("tenant_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!pu?.tenant_id) {
        router.push("/finish-signup");
        return;
      }

      const { data, error } = await supabase.rpc("chiefos_list_vendors", {
        p_include_deleted: false,
      });

      if (!cancelled) {
        if (error) {
          console.warn(error.message);
          setRows([]);
        } else {
          setRows((data ?? []) as VendorRow[]);
        }
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => String(r.vendor || "").toLowerCase().includes(qq));
  }, [rows, q]);

  const selectedAliases = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .filter((v) => v && v !== "—");
  }, [selected]);

  const suggestedCanonical = useMemo(() => {
    const clean = rows
      .filter((r) => (r.vendor || "").trim() && r.vendor !== "—")
      .slice()
      .sort(
        (a, b) =>
          (Number(b.count || 0) - Number(a.count || 0)) ||
          (Number(b.total_amount || 0) - Number(a.total_amount || 0))
      );
    return clean[0]?.vendor ?? "";
  }, [rows]);

  function toggleAllVisible(on: boolean) {
    const next: Record<string, boolean> = {};
    if (on) for (const r of filtered) next[r.vendor] = true;
    setSelected(next);
  }

  const allVisibleSelected =
    filtered.length > 0 && selectedAliases.length === filtered.length;

  async function normalize() {
    const canon = canonical.trim();
    if (!canon) return alert("Canonical vendor is required.");
    if (selectedAliases.length === 0) return alert("Select at least 1 alias vendor to normalize.");

    if (!confirm(`Normalize ${selectedAliases.length} vendor names into "${canon}"?`)) return;

    try {
      setBusy(true);

      const { data, error } = await supabase.rpc("chiefos_normalize_vendor", {
        p_canonical: canon,
        p_aliases: selectedAliases,
      });

      if (error) throw error;

      alert(
        `Normalized ${data?.[0]?.updated_count ?? 0} expenses.\nSaved ${data?.[0]?.alias_count ?? 0} alias rows.`
      );

      // Reload vendor stats
      const { data: fresh, error: freshErr } = await supabase.rpc("chiefos_list_vendors", {
        p_include_deleted: false,
      });
      if (freshErr) throw freshErr;

      setRows((fresh ?? []) as VendorRow[]);
      setSelected({});
      setCanonical("");
    } catch (e: any) {
      alert(e?.message ?? "Normalization failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-600">Loading vendors…</div>;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Vendor Normalization</h1>
            <p className="mt-1 text-sm text-gray-500">
              Merge vendor variants (Home Depot / HOMEDEPOT / HomeDepot) into a canonical name.
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
              onClick={() => router.push("/app/expenses/audit")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Audit
            </button>
            <button
              onClick={() => router.push("/app/expenses/trash")}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Trash
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-lg border p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Search vendors</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Type vendor…"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Canonical vendor name</label>
              <input
                value={canonical}
                onChange={(e) => setCanonical(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder='e.g. "Home Depot"'
              />

              {suggestedCanonical && (
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                  <span>
                    Suggestion: <b className="text-gray-800">{suggestedCanonical}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCanonical(suggestedCanonical)}
                    className="rounded-full border px-2 py-0.5 hover:bg-gray-50"
                    disabled={busy}
                    title="Set canonical to the most common vendor"
                  >
                    Use suggestion
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                onClick={() => toggleAllVisible(!allVisibleSelected)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
              >
                {allVisibleSelected ? "Clear selection" : "Select all (visible)"}
              </button>

              <button
                onClick={normalize}
                disabled={busy}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {busy ? "Normalizing…" : "Normalize selected → canonical"}
              </button>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600">
            Selected aliases: <b>{selectedAliases.length}</b>
            <span className="ml-2 text-xs text-gray-500">
              Tip: click a vendor row to set canonical quickly.
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-12 text-gray-600">No vendors match your search.</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-left text-sm text-gray-600">
                  <th className="py-2 pr-4 w-10"></th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Count</th>
                  <th className="py-2 pr-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.vendor}
                    className="border-b text-sm hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      const v = String(r.vendor || "").trim();
                      if (v && v !== "—") setCanonical(v);
                    }}
                    title="Click to set canonical"
                  >
                    <td
                      className="py-2 pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected[r.vendor]}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [r.vendor]: e.target.checked }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-4">{r.vendor || "—"}</td>
                    <td className="py-2 pr-4">{Number(r.count || 0)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{money(r.total_amount)}</td>
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
