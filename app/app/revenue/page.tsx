"use client";

import { useTenantGate } from "@/lib/useTenantGate";

export default function RevenuePage() {
  const { loading: gateLoading } = useTenantGate({ requireWhatsApp: true });

  if (gateLoading) return <div className="p-8 text-gray-600">Loading revenue…</div>;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold">Revenue</h1>
        <p className="mt-2 text-gray-600">
          Review and manage revenue logs (payments, invoices, deposits).
        </p>

        <div className="mt-8 rounded-lg border p-6 text-sm text-gray-600">
          Coming next: search, filters, edit, soft delete.
        </div>
      </div>
    </main>
  );
}
