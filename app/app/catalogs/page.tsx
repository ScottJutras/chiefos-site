"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiFetch";

type Supplier = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website_url: string | null;
  catalog_update_cadence: string;
  product_count: number;
  freshness: "FRESH" | "AGING" | "STALE" | "EXPIRED" | "UNKNOWN";
  price_effective_date: string | null;
};

const FRESHNESS_STYLES: Record<string, string> = {
  FRESH:   "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  AGING:   "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
  STALE:   "text-orange-300 bg-orange-500/10 border-orange-500/20",
  EXPIRED: "text-red-300 bg-red-500/10 border-red-500/20",
  UNKNOWN: "text-white/40 bg-white/5 border-white/10",
};

export default function CatalogsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/catalog/suppliers")
      .then((data) => setSuppliers(data.suppliers ?? data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="space-y-6">
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">Suppliers</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Product Catalogs
        </h1>
        <div className="mt-3 text-sm text-white/60">
          Browse supplier pricing to build quotes and itemize expenses against real material costs.
        </div>
      </div>

      {loading && (
        <div className="text-sm text-white/40 px-1">Loading catalogs…</div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error.includes("PLAN_NOT_INCLUDED")
            ? "Supplier catalogs require a Starter or Pro plan."
            : error}
        </div>
      )}

      {!loading && !error && suppliers.length === 0 && (
        <div className="text-sm text-white/40 px-1">No catalogs available yet.</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <Link
            key={s.id}
            href={`/app/catalogs/${s.slug}`}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.06] hover:-translate-y-[1px] active:translate-y-0"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold text-white/90">{s.name}</div>
              <span
                className={[
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0",
                  FRESHNESS_STYLES[s.freshness] ?? FRESHNESS_STYLES.UNKNOWN,
                ].join(" ")}
              >
                {s.freshness}
              </span>
            </div>

            {s.description && (
              <div className="mt-2 text-sm text-white/55 leading-relaxed line-clamp-2">
                {s.description}
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 text-xs text-white/40">
              <span>{s.product_count.toLocaleString()} products</span>
              {s.price_effective_date && (
                <span>Priced {new Date(s.price_effective_date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
