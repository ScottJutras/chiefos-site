"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AskChiefMini from "@/app/app/components/AskChiefMini";
import AskChiefCommandsPanel from "@/app/app/components/AskChiefCommandsPanel";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";
import DecisionCenterNav from "@/app/app/components/DecisionCenterNav";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

function prettyFromEmail(email?: string | null) {
  if (!email) return "";
  const left = email.split("@")[0] || "";
  if (!left) return "";
  const cleaned = left.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

function TopLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-xs text-white/60 hover:text-white/85 transition">
      {label}
    </Link>
  );
}

export default function DashboardPage() {
  const { loading } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");

  // ✅ In-page data browser state (no navigation away)
  const [view, setView] = useState<ViewKey>("expenses");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;

        const user = u?.user;
        const userId = user?.id || "";

        const metaFallback =
          (user?.user_metadata?.business_name as string | undefined) ||
          (user?.user_metadata?.company as string | undefined) ||
          (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          "";

        const emailFallback = prettyFromEmail(user?.email || null);

        if (!userId) {
          if (alive) setWorkspaceName(metaFallback || emailFallback || "Your system");
          return;
        }

        // 1) Resolve tenant_id via portal membership (auth.uid() context)
        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (puErr) {
          if (alive) setWorkspaceName(metaFallback || emailFallback || "Your system");
          return;
        }

        const tenantId = (pu as any)?.tenant_id as string | null;

        if (!tenantId) {
          if (alive) setWorkspaceName(metaFallback || emailFallback || "Your system");
          return;
        }

        // 2) Read business name from chiefos_tenants (deterministic)
        const { data: t, error: tErr } = await supabase
          .from("chiefos_tenants")
          .select("business_name,name")
          .eq("id", tenantId)
          .maybeSingle();

        if (tErr) {
          if (alive) setWorkspaceName(metaFallback || emailFallback || "Your system");
          return;
        }

        const dbBusiness =
          ((t as any)?.business_name as string | null) || ((t as any)?.name as string | null) || "";

        const finalName = (dbBusiness || "").trim() || metaFallback || emailFallback || "Your system";

        if (alive) setWorkspaceName(finalName);
      } catch {
        // fail-soft
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
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* ─────────────────────────────────────────────────────────────
            Minimal header row (keeps space tight)
        ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-white/45">Workspace</div>
            <div className="truncate text-lg font-semibold text-white/90">{titleLine}</div>
          </div>

          {/* Keep only the truly “settings-y” stuff up here (optional) */}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <TopLink href="/app/settings/billing" label="Billing" />
            <TopLink href="/app/settings" label="Settings" />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Decision Centre prototype layout
            Left = Ask Chief + in-page data browser (scrollable)
            Right = Commands + Jobs (sticky)
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
          {/* Left: Ask Chief + in-page data */}
          <div className="min-w-0 space-y-4">
            {/* Ask Chief stays on this page */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="text-xs text-white/55">Ask Chief</div>
              <div className="mt-1 text-sm text-white/65">
                Ask about spend, revenue, profit, job performance — Chief answers from your ledger.
              </div>

              <div className="mt-4">
                {/* NOTE: AskChiefMini currently includes an “Open Chief →” link + prompt chips.
                    If you want, we’ll patch AskChiefMini next to remove those (small edit).
                 */}
                <AskChiefMini />
              </div>

              {/* ✅ Your requested nav row (in-page switching, no route change) */}
              <DecisionCenterNav view={view} setView={setView} />
            </div>

            {/* ✅ In-page data panel (Expenses will work immediately via chiefos_portal_expenses)
                Revenue/Time/Tasks will fail-soft until those portal-safe surfaces exist.
             */}
            <DashboardDataPanel view={view} />
          </div>

          {/* Right: sticky decision panels */}
          <div className="space-y-4 xl:sticky xl:top-6 h-fit">
            {/* Commands anchor so the nav “Commands” jumps here */}
            <div id="command-reference">
              <AskChiefCommandsPanel />
            </div>

            <JobsDecisionCenterPanel title="Jobs" />
          </div>
        </div>

        <div className="mt-4 text-[11px] text-white/40">
          Portal-safe data panels detected: chiefos_portal_expenses (✅). Revenue/Time/Tasks panels will become fully
          deterministic once their portal-safe views exist.
        </div>
      </div>
    </main>
  );
}