import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "./nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header
        className="sticky z-20 border-b border-white/10 bg-black/80 backdrop-blur-xl"
        style={{ top: "var(--early-access-banner-h)" }}
      >
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/app/dashboard"
                className="shrink-0 font-semibold tracking-tight text-white hover:text-white/90 transition"
              >
                ChiefOS
              </Link>

              <div className="hidden lg:block">
                <AppNav />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/app/chief"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 transition"
              >
                Ask Chief
              </Link>

              <Link
                href="/app/settings"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10 transition"
              >
                Settings
              </Link>
            </div>
          </div>

          <div className="mt-3 lg:hidden">
            <AppNav />
          </div>
        </div>
      </header>

      <main className="w-full px-2 py-3">{children}</main>
    </div>
  );
}