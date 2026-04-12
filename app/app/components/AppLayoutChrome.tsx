"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import ChiefPullTab from "./ChiefPullTab";
import GlobalChiefDock from "./GlobalChiefDock";

/**
 * All the layout chrome (sidebar, mobile header, pull-tab, dock, bottom nav).
 * Renders bare {children} when ?embed=1 so the Chief iframe doesn't show
 * any surrounding UI — preventing the dock-inside-dock problem and
 * navigation away from the chat.
 */
function AppLayoutChromeInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();

  if (searchParams.get("embed") === "1") {
    // Strip all chrome — just the page content
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <div className="flex flex-1 flex-col md:ml-56">
        {/* Mobile-only slim top bar */}
        <header
          className="sticky top-0 z-30 flex items-center border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl md:hidden"
          style={{ top: "var(--early-access-banner-h, 0px)" }}
        >
          <Link
            href="/app/jobs"
            className="text-base font-semibold tracking-tight text-white"
          >
            ChiefOS
          </Link>
        </header>

        <main className="w-full px-4 py-6 pb-24 md:pb-6">{children}</main>
      </div>

      {/* Ask Chief floating pull-tab — right edge */}
      <ChiefPullTab />

      {/* Chief panel lives outside main so backdrop-blur doesn't trap it */}
      <GlobalChiefDock />

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}

export default function AppLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-black text-white">
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    }>
      <AppLayoutChromeInner>{children}</AppLayoutChromeInner>
    </Suspense>
  );
}
