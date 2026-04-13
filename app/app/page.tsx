"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenantGate } from "@/lib/useTenantGate";


export default function AppIndexPage() {
  const router = useRouter();

  // Choose whether /app requires WhatsApp.
  // If you want to allow portal-only usage, set false.
  const { loading, userId, tenantId, hasWhatsApp } = useTenantGate({ requireWhatsApp: false });

  useEffect(() => {
    if (loading) return;

    // useTenantGate already redirects when missing auth/tenant,
    // so if we get here and have user+tenant, we can route.
    if (userId && tenantId) {
      // First-time / not-yet-linked users → onboarding welcome page
      router.replace(hasWhatsApp ? "/app/jobs" : "/app/welcome");
    }
  }, [loading, userId, tenantId, hasWhatsApp, router]);

  return <div className="p-8 text-gray-600">Loading your workspace…</div>;
}
