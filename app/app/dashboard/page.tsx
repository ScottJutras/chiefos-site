"use client";

import Link from "next/link";
import AskChiefMini from "@/app/app/components/AskChiefMini";
import { useTenantGate } from "@/lib/useTenantGate";

function Card({
  title,
  desc,
  href,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "group rounded-2xl border border-white/10 bg-white/5 p-5",
        "hover:bg-white/10 transition",
        "flex flex-col gap-2",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        {badge ? (
          <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/70">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="text-sm text-white/60">{desc}</div>
      <div className="mt-2 text-xs text-white/55 group-hover:text-white/75 transition">
        Open →
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  // We keep this consistent with the rest of the portal.
  // If auth/tenant is missing, useTenantGate will handle redirects.
  const { loading } = useTenantGate({ requireWhatsApp: false });

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <div className="text-xs text-white/55">Workspace</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white/90">Dashboard</h1>
          <p className="mt-2 text-sm text-white/60">
            Your ledger at a glance. Ask Chief when you want the why — not another dashboard.
          </p>
        </div>

        {/* Ask Chief mini entry (inevitable) */}
        <div className="mt-6">
          <AskChiefMini />
        </div>

        {/* Quick nav cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            title="Expenses"
            desc="Receipts, overhead, job costs. Keep it clean, keep it traceable."
            href="/app/expenses"
            badge="Ledger"
          />
          <Card
            title="Revenue"
            desc="Invoices, payments, money in. See what’s actually been collected."
            href="/app/revenue"
            badge="Cash-in"
          />
          <Card
            title="Time"
            desc="Clock-ins, breaks, approvals. Labor is your biggest cost — track it properly."
            href="/app/time"
            badge="Crew"
          />
          <Card
            title="Tasks"
            desc="What’s open, who owns it, what’s blocking the job."
            href="/app/tasks"
            badge="Ops"
          />
        </div>

        {/* Billing / upgrade */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-semibold text-white/90">Plans & Billing</div>
          <div className="mt-1 text-sm text-white/60">
            Upgrade when you’re ready for crew self-logging and deeper controls.
          </div>
          <div className="mt-3">
            <Link
              href="/app/settings/billing"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
            >
              Manage billing →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
