"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupplierGate } from "@/lib/useSupplierGate";
import { apiFetch } from "@/lib/apiFetch";

type Stats = {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  lastUploadAt: string | null;
};

export default function SupplierDashboardPage() {
  const gate = useSupplierGate();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!gate.supplierId) return;

    async function loadStats() {
      try {
        const [products, categories, history] = await Promise.all([
          apiFetch("/api/supplier/products?limit=1"),
          apiFetch("/api/supplier/categories"),
          apiFetch("/api/supplier/upload/history"),
        ]);
        setStats({
          totalProducts: products.total ?? 0,
          activeProducts: products.active ?? 0,
          totalCategories: Array.isArray(categories.categories) ? categories.categories.length : 0,
          lastUploadAt: history.uploads?.[0]?.created_at ?? null,
        });
      } catch {
        // non-fatal — stats are informational
      }
    }

    void loadStats();
  }, [gate.supplierId]);

  if (gate.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-[#706A60]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Pending banner */}
      {gate.status === "pending_review" && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
          <p className="text-sm font-semibold text-yellow-400">Account pending approval</p>
          <p className="mt-1 text-sm text-yellow-300/70">
            Your supplier account is under review by the ChiefOS team. You&apos;ll receive an email
            once approved — typically within 1 business day.
          </p>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E8E2D8]">{gate.supplierName}</h1>
        <p className="mt-1 text-sm text-[#A8A090]">{gate.email}</p>
      </div>

      {gate.status === "active" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total products" value={stats?.totalProducts ?? "—"} />
            <StatCard label="Active products" value={stats?.activeProducts ?? "—"} />
            <StatCard label="Categories" value={stats?.totalCategories ?? "—"} />
            <StatCard
              label="Last upload"
              value={
                stats?.lastUploadAt
                  ? new Date(stats.lastUploadAt).toLocaleDateString()
                  : "Never"
              }
            />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ActionCard
              href="/supplier/catalog"
              title="Manage catalog"
              description="Add, edit, or deactivate products and categories."
              cta="Go to catalog"
            />
            <ActionCard
              href="/supplier/catalog/upload"
              title="Upload price list"
              description="Import a spreadsheet to bulk-update your product catalog."
              cta="Upload spreadsheet"
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-4">
      <p className="text-xs text-[#706A60]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#E8E2D8]">{value}</p>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  cta,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-5 transition hover:border-[rgba(212,168,83,0.3)] hover:bg-[rgba(212,168,83,0.05)]"
    >
      <h3 className="font-semibold text-[#E8E2D8]">{title}</h3>
      <p className="mt-1 text-sm text-[#A8A090]">{description}</p>
      <span className="mt-3 inline-block text-sm font-medium text-[#D4A853] group-hover:text-[#C49843]">
        {cta} →
      </span>
    </Link>
  );
}
