"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { apiFetch } from "@/lib/apiFetch";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_CHIEFOS_ADMIN_EMAIL ?? "";

type Supplier = {
  id: string;
  name: string;
  slug: string;
  status: string;
  supplier_type: string;
  region: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  onboarding_completed: boolean;
  created_at: string;
  product_count?: number;
};

export default function AdminSuppliersPage() {
  const gate = useTenantGate();
  const router = useRouter();

  const [pending, setPending] = useState<Supplier[]>([]);
  const [all, setAll] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const isAdmin = !!ADMIN_EMAIL && gate.email === ADMIN_EMAIL;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [pendingData, allData] = await Promise.all([
        apiFetch("/api/admin/suppliers/pending"),
        apiFetch("/api/admin/suppliers"),
      ]);
      setPending(pendingData.suppliers ?? []);
      setAll(allData.suppliers ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gate.loading) return;
    if (!isAdmin) {
      router.replace("/app/dashboard");
      return;
    }
    void load();
  }, [gate.loading, isAdmin, load, router]);

  async function approve(id: string) {
    setActing(id);
    try {
      await apiFetch(`/api/admin/suppliers/${id}/approve`, { method: "POST" });
      void load();
    } catch (e: any) {
      alert(e?.message || "Approve failed.");
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    if (!confirm("Reject this supplier? This will set their status to inactive.")) return;
    setActing(id);
    try {
      await apiFetch(`/api/admin/suppliers/${id}/reject`, { method: "POST" });
      void load();
    } catch (e: any) {
      alert(e?.message || "Reject failed.");
    } finally {
      setActing(null);
    }
  }

  if (gate.loading) {
    return <div className="py-12 text-center text-sm text-white/40">Checking access...</div>;
  }

  if (!isAdmin) {
    return <div className="py-12 text-center text-sm text-white/40">Redirecting...</div>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Supplier management</h1>
        <p className="mt-1 text-sm text-white/40">ChiefOS admin only</p>
      </div>

      {err && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>
      )}

      {/* Pending */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Pending review{" "}
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-yellow-500/20 px-2 py-0.5 text-sm text-yellow-400">
              {pending.length}
            </span>
          )}
        </h2>

        {loading ? (
          <div className="text-sm text-white/30">Loading...</div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/30">
            No pending applications.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => (
              <div key={s.id} className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="mt-0.5 text-sm text-white/50">
                      {s.primary_contact_name} · {s.primary_contact_email}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge label={s.supplier_type} />
                      <Badge label={s.region} />
                      <span className="text-xs text-white/30">
                        Applied {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(s.id)}
                      disabled={acting === s.id}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => approve(s.id)}
                      disabled={acting === s.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {acting === s.id ? "..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All suppliers */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">All suppliers</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Region</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Products</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-white/30">Loading...</td></tr>
              ) : all.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-white/30">No suppliers.</td></tr>
              ) : (
                all.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 transition hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-white/60">{s.supplier_type}</td>
                    <td className="px-4 py-3 text-white/60">{s.region}</td>
                    <td className="px-4 py-3 text-white/60">{s.product_count ?? "—"}</td>
                    <td className="px-4 py-3 text-white/40">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/50">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400",
    pending_review: "bg-yellow-500/20 text-yellow-400",
    suspended: "bg-orange-500/20 text-orange-400",
    inactive: "bg-white/10 text-white/40",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? "bg-white/10 text-white/40"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
