"use client";

import { useEffect, useState, useCallback } from "react";
import { useSupplierGate } from "@/lib/useSupplierGate";
import { apiFetch } from "@/lib/apiFetch";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  product_count?: number;
};

export default function SupplierCategoriesPage() {
  const gate = useSupplierGate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // New category
  const [addName, setAddName] = useState("");
  const [addParent, setAddParent] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/supplier/categories");
      setCategories(data.categories ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gate.supplierId) return;
    void load();
  }, [gate.supplierId, load]);

  async function addCategory() {
    if (!addName.trim()) return;
    setAdding(true);
    setAddErr(null);
    try {
      await apiFetch("/api/supplier/categories", {
        method: "POST",
        body: JSON.stringify({
          name: addName.trim(),
          parent_id: addParent || null,
        }),
      });
      setAddName("");
      setAddParent("");
      void load();
    } catch (e: any) {
      setAddErr(e?.message || "Failed to add category.");
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/supplier/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditId(null);
      void load();
    } catch (e: any) {
      alert(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? This only works if it has no active products.`)) return;
    try {
      await apiFetch(`/api/supplier/categories/${id}`, { method: "DELETE" });
      void load();
    } catch (e: any) {
      alert(e?.message || "Delete failed.");
    }
  }

  if (gate.loading) {
    return <div className="py-12 text-center text-sm text-white/40">Loading...</div>;
  }

  // Separate top-level and children for display
  const roots = categories.filter((c) => !c.parent_id);
  const children = categories.filter((c) => c.parent_id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Categories</h1>
        <a href="/supplier/catalog" className="text-sm text-white/40 hover:text-white">
          ← Back to catalog
        </a>
      </div>

      {err && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>
      )}

      {/* Add category */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white/60">Add category</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Category name"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
          />
          <select
            value={addParent}
            onChange={(e) => setAddParent(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">Top level</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={addCategory}
            disabled={adding || !addName.trim()}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
        {addErr && <p className="mt-2 text-xs text-red-400">{addErr}</p>}
      </div>

      {/* Category list */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-8 text-center text-sm text-white/30">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/30">No categories yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {roots.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                editId={editId}
                editName={editName}
                saving={saving}
                onStartEdit={(c) => { setEditId(c.id); setEditName(c.name); }}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditId(null)}
                onEditNameChange={setEditName}
                onDelete={deleteCategory}
                indent={false}
              />
            ))}
            {children.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                editId={editId}
                editName={editName}
                saving={saving}
                onStartEdit={(c) => { setEditId(c.id); setEditName(c.name); }}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditId(null)}
                onEditNameChange={setEditName}
                onDelete={deleteCategory}
                indent={true}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  cat,
  editId,
  editName,
  saving,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditNameChange,
  onDelete,
  indent,
}: {
  cat: Category;
  editId: string | null;
  editName: string;
  saving: boolean;
  onStartEdit: (c: Category) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onEditNameChange: (v: string) => void;
  onDelete: (id: string, name: string) => void;
  indent: boolean;
}) {
  const isEditing = editId === cat.id;

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${indent ? "pl-10 bg-white/[0.02]" : ""}`}>
      {isEditing ? (
        <input
          autoFocus
          type="text"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit(cat.id);
            if (e.key === "Escape") onCancelEdit();
          }}
          className="flex-1 rounded border border-white/20 bg-white/5 px-2 py-1 text-sm text-white outline-none"
        />
      ) : (
        <span className="flex-1 text-sm text-white">{cat.name}</span>
      )}

      {cat.product_count !== undefined && (
        <span className="text-xs text-white/30">{cat.product_count} products</span>
      )}

      {isEditing ? (
        <div className="flex gap-1">
          <button
            onClick={() => onSaveEdit(cat.id)}
            disabled={saving}
            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={onCancelEdit} className="text-xs text-white/40 hover:text-white">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onStartEdit(cat)}
            className="text-xs text-white/40 hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(cat.id, cat.name)}
            className="text-xs text-red-400/50 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
