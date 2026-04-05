"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";

type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  unit_price_cents: number;
  price_effective_date: string;
  category_id: string;
};

type SupplierDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website_url: string | null;
  freshness: string;
  price_effective_date: string | null;
  categories: Category[];
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export default function SupplierDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const [supplier, setSupplier]       = useState<SupplierDetail | null>(null);
  const [products, setProducts]       = useState<Product[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);
  const [activeCat, setActiveCat]     = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const LIMIT = 50;

  // Load supplier detail (categories)
  useEffect(() => {
    apiFetch(`/api/catalog/suppliers/${slug}`)
      .then((data) => setSupplier(data.supplier ?? data))
      .catch((e) => setError(e.message));
  }, [slug]);

  // Load products
  const loadProducts = useCallback(async () => {
    if (!supplier) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      });
      if (activeCat) params.set("category_id", activeCat);
      if (search)    params.set("q", search);

      const data = await apiFetch(`/api/catalog/suppliers/${slug}/products?${params}`);
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [supplier, slug, activeCat, search, page]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  function selectCategory(catId: string | null) {
    setActiveCat(catId);
    setPage(0);
    setSearch("");
    setSearchInput("");
  }

  const totalPages = Math.ceil(total / LIMIT);

  if (error) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error.includes("PLAN_NOT_INCLUDED")
            ? "Supplier catalogs require a Starter or Pro plan."
            : error}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <Link href="/app/catalogs" className="text-xs text-white/40 hover:text-white/60 transition">
          ← Catalogs
        </Link>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          {supplier?.name ?? "Loading…"}
        </h1>
        {supplier?.description && (
          <div className="mt-2 text-sm text-white/60">{supplier.description}</div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/40">
          {supplier?.price_effective_date && (
            <span>
              Prices effective{" "}
              {new Date(supplier.price_effective_date).toLocaleDateString("en-CA", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </span>
          )}
          {supplier?.freshness && (
            <span className={[
              "rounded-full border px-2.5 py-0.5 font-medium",
              supplier.freshness === "FRESH"   ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
              supplier.freshness === "AGING"   ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/20" :
              supplier.freshness === "STALE"   ? "text-orange-300 bg-orange-500/10 border-orange-500/20" :
              supplier.freshness === "EXPIRED" ? "text-red-300 bg-red-500/10 border-red-500/20" :
              "text-white/40 bg-white/5 border-white/10",
            ].join(" ")}>
              {supplier.freshness}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 md:flex-row">
        {/* Category sidebar */}
        {supplier && supplier.categories.length > 0 && (
          <aside className="md:w-52 shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 space-y-0.5">
              <button
                onClick={() => selectCategory(null)}
                className={[
                  "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                  activeCat === null
                    ? "bg-white/8 text-white"
                    : "text-white/55 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                All Products
              </button>
              {[...supplier.categories]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat.id)}
                    className={[
                      "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
                      activeCat === cat.id
                        ? "bg-white/8 text-white"
                        : "text-white/55 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    {cat.name}
                  </button>
                ))}
            </div>
          </aside>
        )}

        {/* Product list */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-white/20"
            />
            <button
              type="submit"
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.09]"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/[0.09]"
              >
                Clear
              </button>
            )}
          </form>

          {/* Count */}
          {!loading && (
            <div className="text-xs text-white/40">
              {total.toLocaleString()} product{total !== 1 ? "s" : ""}
              {search ? ` matching "${search}"` : ""}
            </div>
          )}

          {loading && (
            <div className="text-sm text-white/40">Loading products…</div>
          )}

          {/* Product table */}
          {!loading && products.length > 0 && (
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wide">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wide">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-mono text-xs text-white/50 whitespace-nowrap">{p.sku}</td>
                      <td className="px-4 py-3 text-white/85 leading-snug">{p.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/90 font-medium whitespace-nowrap">
                        {formatPrice(p.unit_price_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-white/40 whitespace-nowrap">{p.unit_of_measure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && products.length === 0 && !error && (
            <div className="text-sm text-white/40">No products found.</div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.09] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-white/40">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.09] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}

          {supplier?.price_effective_date && (
            <div className="text-xs text-white/30 italic">
              Pricing as of{" "}
              {new Date(supplier.price_effective_date).toLocaleDateString("en-CA", {
                year: "numeric", month: "long", day: "numeric",
              })}. Confirm current pricing with {supplier.name} before finalizing quotes.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
