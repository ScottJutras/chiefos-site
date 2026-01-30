"use client";

import { useTenantGate } from "@/lib/useTenantGate";
import { usePathname } from "next/navigation";
import React from "react";

function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="h-6 w-40 rounded bg-gray-100" />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 rounded-lg border bg-gray-50" />
          <div className="h-24 rounded-lg border bg-gray-50" />
          <div className="h-24 rounded-lg border bg-gray-50" />
        </div>
        <div className="mt-6 h-64 rounded-lg border bg-gray-50" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Only require WhatsApp for pages that actually need it
  const requireWhatsApp = pathname !== "/app/connect-whatsapp";

  const { loading } = useTenantGate({ requireWhatsApp });

  if (loading) return <AppShellSkeleton />;

  return <>{children}</>;
}
