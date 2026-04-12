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
    <div className="rounded-2xl border border-[var(--gold-border)] bg-white/[0.04] p-2">
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
                  ? "border-[rgba(212,168,83,0.4)] bg-[rgba(212,168,83,0.15)] text-[#D4A853]"
                  : "border-white/10 bg-black/40 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]",
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