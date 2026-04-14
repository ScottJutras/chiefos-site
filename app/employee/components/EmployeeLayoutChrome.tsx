"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/employee/dashboard", label: "Home" },
  { href: "/employee/time", label: "Time" },
];

export default function EmployeeLayoutChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0C0B0A]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-[#D4A853]">ChiefOS</span>
          <span className="text-xs text-white/30 font-medium border border-white/10 px-2 py-0.5 rounded-full">Employee</span>
        </div>

        <nav className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-6 pb-24">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-white/20 pb-4">
        ChiefOS Employee Portal
      </footer>
    </div>
  );
}
