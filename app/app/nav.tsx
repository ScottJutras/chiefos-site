// app/app/nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/expenses", label: "Expenses" },
  { href: "/app/revenue", label: "Revenue" },
  { href: "/app/time", label: "Time" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/settings/billing", label: "Billing" }, // ✅ add
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "rounded-xl px-3 py-1.5 text-sm font-medium transition",
              "border",
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
