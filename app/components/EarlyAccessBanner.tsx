// chiefos-site/app/components/EarlyAccessBanner.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function EarlyAccessBanner() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement | null>(null);

  const show =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/early-access" ||
    pathname === "/finish-signup" ||
    pathname.startsWith("/app");

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

  if (!show) return null;

  return (
    <div
      ref={ref}
      className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-white/80">
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-1 text-[11px] tracking-wide">
            TESTER ACCESS
          </span>
          <span className="hidden sm:inline">
            Start testing ChiefOS. No approval needed.
          </span>
        </div>
        <div className="text-white/60">ChiefOS</div>
      </div>
    </div>
  );
}