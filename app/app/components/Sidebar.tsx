"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Nav structure ────────────────────────────────────────────────────────────

const mainGroups = [
  {
    label: null,
    items: [
      { href: "/app/dashboard", label: "Dashboard" },
    ],
  },
  {
    label: "WORK",
    items: [
      { href: "/app/jobs", label: "Jobs" },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { href: "/app/activity/expenses", label: "My Books" },
      { href: "/app/overhead",          label: "Overhead"  },
    ],
  },
];

const bottomItems = [
  { href: "/app/uploads",  label: "Inbox"    },
  { href: "/app/settings", label: "Settings" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [pendingCount,         setPendingCount]         = useState(0);
  const [overdueOverheadCount, setOverdueOverheadCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function fetchCounts() {
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

        // Inbox badge: pending intake items
        const { count: intakeCount } = await supabase
          .from("intake_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["pending_review", "uploaded", "validated", "extracted"]);

        // Overhead badge: recurring items due this month with no payment confirmed
        const now          = new Date();
        const todayDay     = now.getDate();
        const currentYear  = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const [{ data: dueItems }, { data: payments }] = await Promise.all([
          supabase
            .from("overhead_items")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("active", true)
            .eq("item_type", "recurring")
            .lte("due_day", todayDay),
          supabase
            .from("overhead_payments")
            .select("item_id")
            .eq("tenant_id", tenantId)
            .eq("period_year", currentYear)
            .eq("period_month", currentMonth),
        ]);

        const paidIds      = new Set((payments || []).map((p: any) => p.item_id));
        const overdueCount = (dueItems || []).filter((i: any) => !paidIds.has(i.id)).length;

        if (alive) {
          setPendingCount(intakeCount ?? 0);
          setOverdueOverheadCount(overdueCount);
        }
      } catch {
        // fail-soft — badges just won't show
      }
    }

    void fetchCounts();
    return () => { alive = false; };
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function badge(href: string) {
    if (href === "/app/uploads"  && pendingCount > 0)         return pendingCount;
    if (href === "/app/overhead" && overdueOverheadCount > 0) return overdueOverheadCount;
    return null;
  }

  function navLink(href: string, label: string) {
    const active  = isActive(pathname, href);
    const badgeN  = badge(href);
    return (
      <Link
        key={href}
        href={href}
        className={[
          "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
          active
            ? "bg-white/8 text-white"
            : "text-white/55 hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        {label}
        {badgeN !== null && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none">
            {badgeN > 99 ? "99+" : badgeN}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-full w-56 flex-col border-r border-white/10 bg-black md:flex">

      {/* Logo */}
      <div className="px-5 py-5">
        <Link
          href="/app/dashboard"
          className="text-base font-semibold tracking-tight text-white hover:text-white/80 transition"
        >
          ChiefOS
        </Link>
      </div>

      <div className="mx-4 border-t border-white/8" />

      {/* Main nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {mainGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25 select-none">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => navLink(item.href, item.label))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section — Inbox + Settings */}
      <div className="px-3 pb-3">
        <div className="mb-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {bottomItems.map((item) => navLink(item.href, item.label))}
        </div>
      </div>

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
