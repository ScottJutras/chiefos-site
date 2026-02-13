// app/app/expenses/vendors/page.tsx
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

function chip(cls: string) {
  return [
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
    cls,
  ].join(" ");
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
      try {
        const { data, error } = await supabase.rpc("chiefos_list_vendors", {
          p_include_deleted: false,
        });

        if (error) throw error;
        if (!cancelled) setRows((data ?? []) as VendorRow[]);
      } catch (e: any) {
        if (!cancelled) {
          console.warn(e?.message ?? "Failed to load vendors.");
          setRows([]);
        }
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
    if (!qq) return rows;
    return rows.filter((r) => String(r.vendor || "").toLowerCase().includes(qq));
  }, [rows, q]);

  const selectedAliases = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .filter((v) => v && v !== "—");
  }, [selected]);

  // For “Select all visible”, only include selectable aliases (ignore "—")
  const selectableVisibleAliases = useMemo(() => {
    return filtered.map((r) => String(r.vendor || "").trim()).filter((v) => v && v !== "—");
  }, [filtered]);

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
    const next: Record<string, boolean> = { ...selected };
    if (on) {
      for (const v of selectableVisibleAliases) next[v] = true;
    } else {
      for (const v of selectableVisibleAliases) delete next[v];
    }
    setSelected(next);
  }

  const allVisibleSelected =
    selectableVisibleAliases.length > 0 &&
    selectableVisibleAliases.every((v) => !!selected[v]);

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

  if (gateLoading || loading) return <div className="p-8 text-white/70">Loading vendors…</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Expenses</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Vendors</h1>
            <p className="mt-1 text-sm text-white/60">
              Merge vendor variants (Home Depot / HOMEDEPOT / HomeDepot) into a canonical name.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Visible</span>
              <span className="text-white">{filtered.length}</span>
            </div>
            <div className={chip("border-white/10 bg-black/40 text-white/70")}>
              <span className="text-white/45">Selected</span>
              <span className="text-white">{selectedAliases.length}</span>
            </div>

            <button
              onClick={() => router.push("/app/expenses")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Back
            </button>
            <button
              onClick={() => router.push("/app/expenses/audit")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Audit
            </button>
            <button
              onClick={() => router.push("/app/expenses/trash")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Trash
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-white/60 mb-1">Search vendors</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                placeholder="Type vendor…"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-white/60 mb-1">Canonical vendor name</label>
              <input
                value={canonical}
                onChange={(e) => setCanonical(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
                placeholder='e.g. "Home Depot"'
              />

              {suggestedCanonical && (
                <div className="mt-2 text-xs text-white/55 flex items-center gap-2 flex-wrap">
                  <span>
                    Suggestion: <b className="text-white/85">{suggestedCanonical}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCanonical(suggestedCanonical)}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10 text-white/80"
                    disabled={busy}
                    title="Set canonical to the most common vendor"
                  >
                    Use suggestion
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex gap-2 flex-wrap">
              <button
                onClick={() => toggleAllVisible(!allVisibleSelected)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                disabled={busy || selectableVisibleAliases.length === 0}
              >
                {allVisibleSelected ? "Clear selection" : "Select all (visible)"}
              </button>

              <button
                onClick={normalize}
                disabled={busy}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
              >
                {busy ? "Normalizing…" : "Normalize → canonical"}
              </button>
            </div>
          </div>

          <div className="mt-3 text-sm text-white/60">
            Selected aliases: <b className="text-white/85">{selectedAliases.length}</b>
            <span className="ml-2 text-xs text-white/45">
              Tip: click a vendor row to set canonical quickly.
            </span>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            No vendors match your search.
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/60">
                  <th className="py-3 pl-4 pr-4 w-10"></th>
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 pr-4">Count</th>
                  <th className="py-3 pr-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const v = String(r.vendor || "").trim() || "—";
                  return (
                    <tr
                      key={v}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        if (v && v !== "—") setCanonical(v);
                      }}
                      title="Click to set canonical"
                    >
                      <td className="py-3 pl-4 pr-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!selected[v]}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [v]: e.target.checked }))
                          }
                          disabled={v === "—"}
                        />
                      </td>
                      <td className="py-3 pr-4 text-white/85">{v}</td>
                      <td className="py-3 pr-4 text-white/70">{Number(r.count || 0)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap text-white/85">
                        {money(r.total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
