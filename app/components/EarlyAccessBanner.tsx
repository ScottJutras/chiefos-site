"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type BannerKind = "tester" | "auth" | "app";

export default function EarlyAccessBanner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
      const fromQuery = String(searchParams.get("mode") || "").trim().toLowerCase();
      if (fromQuery) {
        setSignupMode(fromQuery);
        return;
      }

      if (typeof window !== "undefined") {
        const fromStorage = String(localStorage.getItem("chiefos_signup_mode") || "")
          .trim()
          .toLowerCase();
        setSignupMode(fromStorage);
      }
    } catch {
      setSignupMode("");
    }
  }, [searchParams]);

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
      ? "bg-white/10 text-white"
      : banner.kind === "app"
        ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20"
        : "bg-white/10 text-white";

  return (
    <div
      ref={ref}
      className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-white/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`rounded px-2 py-1 text-[11px] tracking-wide shrink-0 ${badgeClass}`}>
            {banner.badge}
          </span>
          <span className="hidden sm:inline truncate">{banner.message}</span>
        </div>
        <div className="text-white/60 shrink-0">ChiefOS</div>
      </div>
    </div>
  );
}