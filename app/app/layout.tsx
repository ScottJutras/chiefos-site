import type { ReactNode } from "react";
import Link from "next/link";
import Sidebar from "./components/Sidebar";
import ChiefPullTab from "./components/ChiefPullTab";
import GlobalChiefDock from "./components/GlobalChiefDock";

function MobileTabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-white/78 transition hover:bg-white/8 hover:text-white"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/55" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

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

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/92 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-3xl items-stretch gap-2 rounded-[24px] border border-white/10 bg-white/[0.04] p-2">
          <MobileTabLink href="/app/jobs"              label="Jobs" />
          <MobileTabLink href="/app/activity/expenses" label="My Books" />
          <MobileTabLink href="/app/pending-review"    label="Review" />
          <MobileTabLink href="/app/uploads"           label="Log" />
          <MobileTabLink href="/app/documents"         label="Docs" />
        </div>
      </nav>
    </div>
  );
}
