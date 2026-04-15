"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantGate } from "@/lib/useTenantGate";
import { fetchWhoami, type PortalRole } from "@/lib/whoami";


export default function AppIndexPage() {
  const router = useRouter();

  // Choose whether /app requires WhatsApp.
  // If you want to allow portal-only usage, set false.
  const { loading, userId, tenantId, hasWhatsApp } = useTenantGate({ requireWhatsApp: false });
  const [role, setRole] = useState<PortalRole | "pending">("pending");

  useEffect(() => {
    let alive = true;
    (async () => {
      const w = await fetchWhoami();
      if (!alive) return;
      setRole(w?.ok ? (w.role as PortalRole) : null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loading || role === "pending") return;

    // useTenantGate already redirects when missing auth/tenant,
    // so if we get here and have user+tenant, we can route.
    if (userId && tenantId) {
      // Employees and board members skip the owner onboarding flow
      // entirely and go straight to their scoped dashboard.
      if (role === "employee" || role === "board") {
        router.replace("/app/dashboard");
        return;
      }
      // First-time / not-yet-linked owners → onboarding welcome page
      router.replace(hasWhatsApp ? "/app/jobs" : "/app/welcome");
    }
  }, [loading, role, userId, tenantId, hasWhatsApp, router]);

  return <div className="p-8 text-gray-600">Loading your workspace…</div>;
}
