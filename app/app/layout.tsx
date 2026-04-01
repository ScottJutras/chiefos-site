import type { ReactNode } from "react";
import Link from "next/link";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import ChiefPullTab from "./components/ChiefPullTab";
import GlobalChiefDock from "./components/GlobalChiefDock";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Left sidebar — desktop (md+) only */}
      <Sidebar />

      {/* Main content area */}
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

      {/* Mobile bottom nav — client component so it can show the pending badge */}
      <MobileNav />
    </div>
  );
}
