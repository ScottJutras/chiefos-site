"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/app/jobs",                label: "Jobs" },
  { href: "/app/activity/expenses",   label: "My Books" },
  { href: "/app/pending-review",      label: "Review" },
  { href: "/app/uploads",             label: "Log / Upload" },
  { href: "/app/documents",           label: "Documents" },
  { href: "/app/dashboard",           label: "Dashboard" },
  { href: "/app/settings",            label: "Settings" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-full w-56 flex-col border-r border-white/10 bg-black md:flex">
      {/* Logo */}
      <div className="px-5 py-5">
        <Link
          href="/app/jobs"
          className="text-base font-semibold tracking-tight text-white hover:text-white/80 transition"
        >
          ChiefOS
        </Link>
      </div>

      <div className="mx-4 border-t border-white/8" />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-white/8 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6">
        <div className="mb-2 border-t border-white/8" />
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition hover:bg-white/5 hover:text-white/70"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
