"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/dashboard", label: "Home" },
  { href: "/app/pending-review", label: "Review" },
  { href: "/app/uploads", label: "Capture" },
  { href: "/app/activity/expenses", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/chief", label: "Chief" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");

        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
              active
                ? "border-white/20 bg-white text-black"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}