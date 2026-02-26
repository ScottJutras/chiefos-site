// app/app/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "./nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header
        className="sticky z-20 border-b border-white/10 bg-black/70 backdrop-blur-xl"
        style={{ top: "var(--early-access-banner-h)" }}
      >
        {/* Header: full width, small padding */}
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/app"
              className="font-semibold tracking-tight hover:text-white/90 transition"
            >
              ChiefOS
            </Link>

            <div className="flex items-center gap-3">
              <AppNav />
            </div>
          </div>
        </div>
      </header>

      {/* Main: full width, minimal padding */}
      <main className="w-full px-2 py-3">{children}</main>
    </div>
  );
}