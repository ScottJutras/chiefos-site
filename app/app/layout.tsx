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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
      </header>

      {/* IMPORTANT: no top padding here (header already consumes height) */}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
