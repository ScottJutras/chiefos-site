// C:\...\chiefos-site\app\app\layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { AppNav } from "./nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/app" className="font-semibold">
            ChiefOS
          </Link>
          <AppNav />
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
