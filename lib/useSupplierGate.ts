"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/apiFetch";

type SupplierStatus = "pending_review" | "active" | "suspended" | "inactive";
type SupplierRole = "owner" | "admin" | "editor";

type SupplierGateState = {
  loading: boolean;
  supplierId: string | null;
  supplierName: string | null;
  supplierSlug: string | null;
  role: SupplierRole | null;
  status: SupplierStatus | null;
  email: string | null;
  fullName: string | null;
  onboardingCompleted: boolean;
  reason: string | null;
};

export function useSupplierGate() {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<SupplierGateState>({
    loading: true,
    supplierId: null,
    supplierName: null,
    supplierSlug: null,
    role: null,
    status: null,
    email: null,
    fullName: null,
    onboardingCompleted: false,
    reason: null,
  });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    function safeSet(next: Partial<SupplierGateState>) {
      if (cancelled) return;
      setState((prev) => ({ ...prev, ...next }));
    }

    function safePush(target: string) {
      if (!target || pathname === target) return;
      router.push(target);
    }

    async function run() {
      try {
        const data: any = await apiFetch("/api/supplier/me");

        if (!data?.ok) {
          const err = data?.error || "me-failed";

          if (err === "missing_bearer" || err === "invalid_session") {
            attempts += 1;
            if (attempts <= 6) {
              safeSet({ loading: true, reason: "waiting-session" });
              setTimeout(() => { if (!cancelled) void run(); }, 350);
              return;
            }
            safeSet({ loading: false, reason: "no-session" });
            safePush("/supplier/login");
            return;
          }

          safeSet({ loading: false, reason: err });
          safePush("/supplier/login");
          return;
        }

        const { supplierUser, supplier } = data;

        if (!supplierUser || !supplier) {
          safeSet({ loading: false, reason: "no-supplier-record" });
          safePush("/supplier/login");
          return;
        }

        safeSet({
          loading: false,
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierSlug: supplier.slug,
          role: supplierUser.role as SupplierRole,
          status: supplier.status as SupplierStatus,
          email: supplierUser.email,
          fullName: supplierUser.full_name,
          onboardingCompleted: !!supplier.onboarding_completed,
          reason: null,
        });
      } catch (e: any) {
        const status = e?.status;

        if (status === 401 || status === 403) {
          safeSet({ loading: false, reason: "unauthorized" });
          safePush("/supplier/login");
          return;
        }

        // Retry on network errors up to 3 times
        attempts += 1;
        if (attempts <= 3) {
          setTimeout(() => { if (!cancelled) void run(); }, 500);
          return;
        }

        safeSet({ loading: false, reason: "error" });
        safePush("/supplier/login");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return state;
}
