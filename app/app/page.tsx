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
      // Employees skip the owner onboarding flow and land in the
      // /employee tree, which has its own layout, sidebar, and pages.
      // Board members and admins use the full owner portal.
      if (role === "employee") {
        router.replace("/employee/dashboard");
        return;
      }
      // First-time / not-yet-linked owners → onboarding welcome page
      router.replace(hasWhatsApp ? "/app/jobs" : "/app/welcome");
    }
  }, [loading, role, userId, tenantId, hasWhatsApp, router]);

  return <div className="p-8 text-gray-600">Loading your workspace…</div>;
}
