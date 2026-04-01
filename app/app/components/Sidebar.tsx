"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/app/jobs",                label: "Jobs" },
  { href: "/app/activity/expenses",   label: "My Books" },
  { href: "/app/overhead",            label: "Overhead" },
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
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function fetchPending() {
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u?.user?.id;
        if (!userId) return;

        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        const tenantId = (pu as any)?.tenant_id as string | null;
        if (!tenantId) return;

        const { count } = await supabase
          .from("intake_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["pending_review", "uploaded", "validated", "extracted"]);

        if (alive) setPendingCount(count ?? 0);
      } catch {
        // fail-soft — badge just won't show
      }
    }

    void fetchPending();

    // Re-check whenever the user navigates away from the review page
    return () => { alive = false; };
  }, [pathname]);

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
          const showBadge = item.href === "/app/pending-review" && pendingCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-white/8 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {item.label}
              {showBadge && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
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
