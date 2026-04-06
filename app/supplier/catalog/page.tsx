"use client";

import { useEffect, useState, useCallback } from "react";
import { useSupplierGate } from "@/lib/useSupplierGate";
import { apiFetch } from "@/lib/apiFetch";

type Category = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  unit_price: number;
  uom: string;
  is_active: boolean;
  price_effective_date: string | null;
  updated_at: string;
};

const PAGE_SIZE = 50;

const emptyForm = {
  sku: "",
  name: "",
  category_id: "",
  unit_price: "",
  uom: "",
};

export default function SupplierCatalogPage() {
  const gate = useSupplierGate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Edit/add modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/api/supplier/categories");
      setCategories(data.categories ?? []);
    } catch {}
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        ...(query ? { q: query } : {}),
        ...(filterCat ? { category_id: filterCat } : {}),
      });
      const data = await apiFetch(`/api/supplier/products?${qs}`);
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setErr(e?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [offset, query, filterCat]);

  useEffect(() => {
    if (!gate.supplierId) return;
    void loadCategories();
  }, [gate.supplierId, loadCategories]);

  useEffect(() => {
    if (!gate.supplierId) return;
    void loadProducts();
  }, [gate.supplierId, loadProducts]);

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm });
    setFormErr(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({
      sku: p.sku,
      name: p.name,
      category_id: p.category_id ?? "",
      unit_price: String(p.unit_price / 100),
      uom: p.uom,
    });
    setFormErr(null);
    setModalOpen(true);
  }

  async function saveProduct() {
    setSaving(true);
    setFormErr(null);
    try {
      const body = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category_id: form.category_id || null,
        unit_price: Math.round(parseFloat(form.unit_price) * 100),
        uom: form.uom.trim() || "each",
      };
      if (editId) {
        await apiFetch(`/api/supplier/products/${editId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/supplier/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      void loadProducts();
    } catch (e: any) {
      setFormErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this product? It will no longer appear in catalogs.")) return;
    try {
      await apiFetch(`/api/supplier/products/${id}`, { method: "DELETE" });
      void loadProducts();
    } catch (e: any) {
      alert(e?.message || "Failed to deactivate.");
    }
  }

  if (gate.loading) {
    return <div className="py-12 text-center text-sm text-white/40">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Catalog</h1>
        <div className="flex gap-2">
          <a
            href="/supplier/catalog/categories"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:text-white"
          >
            Categories
          </a>
          <button
            onClick={openAdd}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            + Add product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search products..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOffset(0); }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10"
        />
        <select
          value={filterCat}
          onChange={(e) => { setFilterCat(e.target.value); setOffset(0); }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {err && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <Th>SKU</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Price</Th>
              <Th>UOM</Th>
              <Th>Status</Th>
              <Th>Last updated</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-white/30">Loading...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-white/30">No products found.</td>
              </tr>
            ) : (
              products.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <Td>{p.sku}</Td>
                    <Td>{p.name}</Td>
                    <Td>{cat?.name ?? <span className="text-white/30">—</span>}</Td>
                    <Td>${(p.unit_price / 100).toFixed(2)}</Td>
                    <Td>{p.uom}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/10 text-white/40"
                      }`}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </Td>
                    <Td>{new Date(p.updated_at).toLocaleDateString()}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-white/50 hover:text-white"
                        >
                          Edit
                        </button>
                        {p.is_active && (
                          <button
                            onClick={() => deactivate(p.id)}
                            className="text-xs text-red-400/60 hover:text-red-400"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-white/50">
          <span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded border border-white/10 px-3 py-1 disabled:opacity-30 hover:text-white"
            >
              Prev
            </button>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded border border-white/10 px-3 py-1 disabled:opacity-30 hover:text-white"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-white">
              {editId ? "Edit product" : "Add product"}
            </h2>

            <div className="space-y-3">
              <MiniField label="SKU" required>
                <input type="text" required value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className={iCls} />
              </MiniField>
              <MiniField label="Name" required>
                <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={iCls} />
              </MiniField>
              <MiniField label="Category">
                <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} className={iCls}>
                  <option value="">— none —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </MiniField>
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="Price ($)" required>
                  <input type="number" step="0.01" min="0" required value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} className={iCls} />
                </MiniField>
                <MiniField label="UOM">
                  <input type="text" value={form.uom} placeholder="each" onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))} className={iCls} />
                </MiniField>
              </div>
            </div>

            {formErr && (
              <div className="mt-3 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{formErr}</div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white">
                Cancel
              </button>
              <button onClick={saveProduct} disabled={saving} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iCls = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30";

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-4 py-3 text-white/70">{children}</td>;
}
function MiniField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-white/50">{label}{required && "*"}</label>
      {children}
    </div>
  );
}
