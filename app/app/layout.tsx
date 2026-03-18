import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "./nav";

function MobileTabLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
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
    <div className="min-h-screen bg-black text-white">
      <header
        className="sticky z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl"
        style={{ top: "var(--early-access-banner-h)" }}
      >
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/app/dashboard"
                className="shrink-0 text-base font-semibold tracking-tight text-white hover:text-white/90 transition"
              >
                ChiefOS
              </Link>

              <div className="hidden xl:block">
                <AppNav />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/app/chief"
                className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                Ask Chief
              </Link>
            </div>
          </div>

          <div className="mt-3 hidden md:block xl:hidden">
            <AppNav />
          </div>
        </div>
      </header>

      <main className="w-full px-2 py-3 pb-24 md:pb-3">{children}</main>

      <nav
        className="
          fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/92 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 backdrop-blur-xl
          md:hidden
        "
      >
        <div className="mx-auto flex max-w-3xl items-stretch gap-2 rounded-[24px] border border-white/10 bg-white/[0.04] p-2">
          <MobileTabLink href="/app/dashboard" label="Home" />
          <MobileTabLink href="/app/pending-review" label="Review" />
          <MobileTabLink href="/app/uploads" label="Capture" />
          <MobileTabLink href="/app/activity/expenses" label="Activity" />
          <MobileTabLink href="/app/chief" label="Chief" />
        </div>
      </nav>
    </div>
  );
}