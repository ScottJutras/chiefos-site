"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  // Jobs-first operating center (currently dashboard route)
  { href: "/app/dashboard", label: "Jobs" },

  // Owner reasoning seat
  { href: "/app/chief", label: "Chief" },

  // Owner review lane
  { href: "/app/pending-review", label: "Pending Review" },

  // Existing surfaces
  { href: "/app/activity", label: "Activity" },
  { href: "/app/crew", label: "Crew" },
  { href: "/app/crew/inbox", label: "Crew Inbox" },

  // System
  { href: "/app/uploads", label: "Uploads" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 flex-wrap">
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