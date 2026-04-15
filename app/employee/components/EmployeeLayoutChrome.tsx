"use client";

import { Suspense, type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";
import ChiefPullTab from "@/app/app/components/ChiefPullTab";
import GlobalChiefDock from "@/app/app/components/GlobalChiefDock";

type Tier = "free" | "starter" | "pro";

type NavItem = {
  href: string;
  label: string;
  minTier?: Tier; // defaults to "free" — show on all tiers
};

const ALL_ITEMS: NavItem[] = [
  { href: "/employee/dashboard", label: "Dashboard" },
  { href: "/employee/time-clock", label: "Time Clock" },
  { href: "/employee/mileage", label: "Mileage" },
  { href: "/employee/photos", label: "Job Site Photos", minTier: "starter" },
  { href: "/employee/tasks", label: "Tasks", minTier: "starter" },
  { href: "/employee/reminders", label: "Reminders", minTier: "starter" },
  { href: "/employee/settings", label: "Settings" },
];

const TIER_ORDER: Tier[] = ["free", "starter", "pro"];

function tierAllows(itemMin: Tier | undefined, tier: Tier): boolean {
  if (!itemMin || itemMin === "free") return true;
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(itemMin);
}

function normalizeTier(raw: string | null | undefined): Tier {
  const v = String(raw || "").toLowerCase().trim();
  if (v === "pro") return "pro";
  if (v === "starter") return "starter";
  return "free";
}

function EmployeeLayoutChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tier, setTier] = useState<Tier>("free");
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const w = await fetchWhoami();
      if (!alive) return;
      if (!w?.ok) {
        router.replace("/login");
        return;
      }
      // Owner / admin / board members use the full /app portal.
      const role = String(w.role || "").toLowerCase();
      if (role === "owner" || role === "admin" || role === "board") {
        router.replace("/app/dashboard");
        return;
      }
      setTier(normalizeTier(w.planKey));
      setResolved(true);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const visibleItems = ALL_ITEMS.filter((i) => tierAllows(i.minTier, tier));

  return (
    <div className="flex min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      {/* Left sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:border-r md:border-white/10 md:bg-[#0C0B0A]/70 md:backdrop-blur-xl">
        <div className="px-4 py-4 border-b border-white/10">
          <Link
            href="/employee/dashboard"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span className="text-[#D4A853]">ChiefOS</span>
            <span className="text-[10px] uppercase tracking-widest text-white/30 border border-white/10 px-1.5 py-0.5 rounded">
              Employee
            </span>
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 px-2 py-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-4 py-3 text-[11px] text-white/25 border-t border-white/10">
          {tier.toUpperCase()} plan
        </div>
      </aside>

      <div className="flex flex-1 flex-col md:min-w-0">
        {/* Mobile-only slim header — logo links to dashboard */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0C0B0A]/90 px-4 py-3 backdrop-blur-xl md:hidden">
          <Link
            href="/employee/dashboard"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span className="text-[#D4A853]">ChiefOS</span>
            <span className="text-[10px] uppercase tracking-widest text-white/30 border border-white/10 px-1.5 py-0.5 rounded">
              Employee
            </span>
          </Link>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 md:pb-8">
          {resolved ? children : (
            <div className="p-8 text-sm text-white/60">Loading your workspace…</div>
          )}
        </main>

        <footer className="hidden md:block text-center text-xs text-white/20 pb-4">
          ChiefOS — Contractor Grade Business Intelligence
        </footer>
      </div>

      {/* Mobile bottom nav for employee portal */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-white/10 bg-[#0C0B0A]/95 backdrop-blur-xl md:hidden">
        {visibleItems.slice(0, 5).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex-1 py-2.5 text-center text-[10px] font-medium transition",
                active ? "text-[#D4A853]" : "text-white/50 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Ask Chief floating pull-tab + dock (support mode for employees) */}
      <ChiefPullTab />
      <GlobalChiefDock />
    </div>
  );
}

export default function EmployeeLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0C0B0A] text-sm text-white/60">
          Loading…
        </div>
      }
    >
      <EmployeeLayoutChromeInner>{children}</EmployeeLayoutChromeInner>
    </Suspense>
  );
}
