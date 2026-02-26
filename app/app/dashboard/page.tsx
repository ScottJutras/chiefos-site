"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AskChiefMini from "@/app/app/components/AskChiefMini";
import AskChiefCommandsPanel from "@/app/app/components/AskChiefCommandsPanel";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

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

function prettyFromEmail(email?: string | null) {
  if (!email) return "";
  const left = email.split("@")[0] || "";
  if (!left) return "";
  const cleaned = left.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function DashboardPage() {
  const { loading } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Auth metadata first (fast, usually present)
        const { data: u } = await supabase.auth.getUser();
        const user = u?.user;

        const metaName =
          (user?.user_metadata?.business_name as string | undefined) ||
          (user?.user_metadata?.company as string | undefined) ||
          (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          "";

        const emailName = prettyFromEmail(user?.email || null);

        // 2) Optional: try common profile / tenant tables (fail-soft if missing)
        // These calls won't crash the UI if the tables don't exist or RLS blocks them.
        let dbBusiness = "";
        let dbPerson = "";

        // Try "tenants"
        try {
          const { data } = await supabase
            .from("tenants")
            .select("business_name,name")
            .limit(1)
            .maybeSingle();
          dbBusiness = (data as any)?.business_name || (data as any)?.name || "";
        } catch {}

        // Try "profiles"
        try {
          if (user?.id) {
            const { data } = await supabase
              .from("profiles")
              .select("business_name,company,full_name,name")
              .eq("id", user.id)
              .maybeSingle();
            dbBusiness =
              dbBusiness ||
              (data as any)?.business_name ||
              (data as any)?.company ||
              "";
            dbPerson =
              (data as any)?.full_name || (data as any)?.name || "";
          }
        } catch {}

        const finalName =
          dbBusiness ||
          metaName ||
          dbPerson ||
          emailName ||
          "Your system";

        if (alive) setWorkspaceName(finalName);
      } catch {
        // keep default
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const titleLine = useMemo(() => workspaceName || "Your system", [workspaceName]);

  if (loading) return <div className="p-8 text-white/70">Loading your workspace…</div>;

  return (
    <main className="min-h-screen">
      <div className="py-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <div className="text-xs text-white/55">Workspace</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white/90">
            {titleLine}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Capture once. Keep it connected. Ask Chief when you want an answer — not another app.
          </p>
        </div>

        {/* Decision Center layout: Ask Chief + Decision panels beside it */}
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
          {/* Left: Ask Chief + the normal dashboard content */}
          <div className="space-y-6">
            <AskChiefMini />

            {/* Quick nav cards (Activity hub) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                title="Expenses"
                desc="Receipts, overhead, job costs — organized and export-ready."
                href="/app/activity/expenses"
                badge="Money out"
              />
              <Card
                title="Revenue"
                desc="Invoices and payments — see what’s been logged and collected."
                href="/app/activity/revenue"
                badge="Money in"
              />
              <Card
                title="Time"
                desc="Clock-ins, breaks, approvals — track labour like it matters."
                href="/app/activity/time"
                badge="Crew"
              />
              <Card
                title="Tasks"
                desc="What’s open, who owns it, and what’s blocking the job."
                href="/app/activity/tasks"
                badge="Ops"
              />
            </div>

            {/* Reference (Commands) + Billing row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                title="Command Reference"
                desc="Copy a command and send it in WhatsApp. Or just send: “commands”."
                href="/app/settings/commands"
                badge="Reference"
              />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-white/90">Plans & Billing</div>
                  <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/70">
                    Monetization
                  </span>
                </div>

                <div className="mt-2 text-sm text-white/60">
                  Upgrade when you’re ready for crew self-logging, approvals, and deeper control.
                </div>

                <div className="mt-4 flex gap-3">
                  <Link
                    href="/app/settings/billing"
                    className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                  >
                    Manage billing →
                  </Link>

                  <Link
                    href="/app/settings"
                    className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                  >
                    Settings →
                  </Link>
                </div>
              </div>
            </div>

            <div className="text-xs text-white/45">
              Tip: This page is your Decision Center. Activity is where day-to-day logging lives.
            </div>
          </div>

          {/* Right: Decision Center panels (sticky stack) */}
          <div className="space-y-4 xl:sticky xl:top-6 h-fit">
            <AskChiefCommandsPanel />
            <JobsDecisionCenterPanel title="Jobs" />
          </div>
        </div>
      </div>
    </main>
  );
}