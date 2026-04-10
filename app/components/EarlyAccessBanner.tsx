"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type BannerKind = "tester" | "auth" | "app";

export default function EarlyAccessBanner() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement | null>(null);

  const [signupMode, setSignupMode] = useState<string>("");

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
        badge: "CHIEFOS",
        message: "Your workspace is active.",
      };
    }

    return {
      kind: "auth" as BannerKind,
      badge: "SECURE ACCESS",
      message: "Create your workspace and continue setup.",
    };
  }, [pathname, signupMode]);

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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-[#A8A090]">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`shrink-0 rounded px-2 py-1 text-[11px] tracking-wide ${badgeClass}`}>
            {banner.badge}
          </span>
          <span className="hidden truncate sm:inline">{banner.message}</span>
        </div>
        <div className="shrink-0 text-[#706A60]">ChiefOS</div>
      </div>
    </div>
  );
}