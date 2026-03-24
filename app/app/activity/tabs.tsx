// app/app/activity/tabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/app/activity/expenses", label: "Expenses" },
  { href: "/app/activity/revenue", label: "Revenue" },
  { href: "/app/activity/time", label: "Time" },
  { href: "/app/activity/mileage", label: "Mileage" },
  { href: "/app/activity/tasks", label: "Tasks" },
];

export default function ActivityTabs() {
  const pathname = usePathname();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold transition border",
                active
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-black/40 text-white/75 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}