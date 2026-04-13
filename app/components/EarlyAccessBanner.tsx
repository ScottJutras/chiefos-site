"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BannerKind = "tester" | "auth" | "app";

export default function EarlyAccessBanner() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement | null>(null);

  const [signupMode, setSignupMode] = useState<string>("");
  const [tenantName, setTenantName] = useState<string | null>(null);

  const show =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/early-access" ||
    pathname === "/finish-signup" ||
    pathname === "/auth/transition" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/app");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = String(params.get("mode") || "").trim().toLowerCase();

      if (fromQuery) {
        setSignupMode(fromQuery);
        return;
      }

      const fromStorage = String(localStorage.getItem("chiefos_signup_mode") || "")
        .trim()
        .toLowerCase();

      setSignupMode(fromStorage);
    } catch {
      setSignupMode("");
    }
  }, [pathname]);

  // Fetch business name when inside the app
  useEffect(() => {
    if (!pathname.startsWith("/app")) return;
    let alive = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u?.user?.id;
        if (!userId) return;
        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();
        const tenantId = (pu as any)?.tenant_id;
        if (!tenantId) return;
        const { data: tenant } = await supabase
          .from("chiefos_tenants")
          .select("name")
          .eq("id", tenantId)
          .maybeSingle();
        const name = (tenant as any)?.name as string | null;
        if (alive && name) setTenantName(name);
      } catch {
        // non-blocking
      }
    })();
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty("--early-access-banner-h", `0px`);

    if (!show) return;

    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const h = el.getBoundingClientRect().height || 0;
      document.documentElement.style.setProperty("--early-access-banner-h", `${h}px`);
    };

    apply();

    const ro = new ResizeObserver(() => apply());
    ro.observe(el);

    window.addEventListener("resize", apply);
    return () => {
      document.documentElement.style.setProperty("--early-access-banner-h", `0px`);
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [show]);

  const banner = useMemo(() => {
    const isTester =
      pathname === "/early-access" ||
      (pathname === "/signup" && signupMode === "tester");

    if (isTester) {
      return {
        kind: "tester" as BannerKind,
        badge: "TESTER ACCESS",
        message: "Start testing ChiefOS. No approval needed.",
      };
    }

    if (pathname.startsWith("/app")) {
      return {
        kind: "app" as BannerKind,
        badge: tenantName || "CHIEFOS",
        message: "Your workspace is active.",
      };
    }

    if (pathname === "/login") {
      return {
        kind: "auth" as BannerKind,
        badge: "COMMAND ACCESS",
        message: "Your business data is live. Sign in and take control.",
      };
    }

    return {
      kind: "auth" as BannerKind,
      badge: "TAKE COMMAND",
      message: "Your AI-powered business OS is ready to deploy.",
    };
  }, [pathname, signupMode, tenantName]);

  if (!show) return null;

  const badgeClass =
    banner.kind === "tester"
      ? "border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.12)] text-[#D4A853]"
      : banner.kind === "app"
        ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
        : "border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.12)] text-[#D4A853]";

  return (
    <div
      ref={ref}
      className="sticky top-0 z-50 w-full border-b border-[rgba(212,168,83,0.15)] bg-[#0C0B0A]/90 backdrop-blur"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-4 py-2 text-xs text-[#A8A090]">
        <div>
          <Link
            href="/"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "2px",
              color: "#D4A853",
              textDecoration: "none",
            }}
          >
            CHIEFOS
          </Link>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2">
          <span className={`shrink-0 rounded px-2 py-1 text-[11px] tracking-wide ${badgeClass}`}>
            {banner.badge}
          </span>
          <span className="hidden truncate sm:inline">{banner.message}</span>
        </div>
        <div />
      </div>
    </div>
  );
}