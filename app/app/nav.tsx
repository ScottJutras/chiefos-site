// C:\...\chiefos-site\app\app\nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/expenses", label: "Expenses" },
  { href: "/app/revenue", label: "Revenue" },
  { href: "/app/time", label: "Time" },
  { href: "/app/tasks", label: "Tasks" },
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
              "rounded-md px-3 py-1.5 text-sm font-medium",
              active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
