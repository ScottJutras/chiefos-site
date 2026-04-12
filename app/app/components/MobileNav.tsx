"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

function MobileTabLink({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-white/78 transition hover:bg-white/8 hover:text-white"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/55" />
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const [combinedBadge, setCombinedBadge] = useState(0);
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

        const now          = new Date();
        const todayDay     = now.getDate();
        const currentYear  = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const [{ count: intakeCount }, { data: dueItems }, { data: payments }] = await Promise.all([
          supabase
            .from("intake_items")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .in("status", ["pending_review", "uploaded", "validated", "extracted"]),
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

        const paidIds = new Set((payments || []).map((p: any) => p.item_id));
        const overdue = (dueItems || []).filter((i: any) => !paidIds.has(i.id)).length;

        if (alive) {
          setCombinedBadge((intakeCount ?? 0) + overdue);
          setOverdueOverheadCount(overdue);
        }
      } catch {
        // fail-soft
      }
    }

    void fetchCounts();
    return () => { alive = false; };
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gold-border)] bg-[#0C0B0A]/95 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-3xl items-stretch gap-2 rounded-[24px] border border-[var(--gold-border)] bg-white/[0.04] p-2">
        <MobileTabLink href="/app/jobs"              label="Jobs" />
        <MobileTabLink href="/app/activity/expenses" label="My Books" />
        <MobileTabLink href="/app/uploads"           label="Inbox" badge={combinedBadge} />
        <MobileTabLink href="/app/overhead"          label="Overhead" badge={overdueOverheadCount} />
        <MobileTabLink href="/app/dashboard"         label="Dashboard" />
      </div>
    </nav>
  );
}
