"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import AskChiefCommandsPanel from "@/app/app/components/AskChiefCommandsPanel";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";

// You created these:
import DecisionCenterNav from "@/app/app/components/DecisionCenterNav";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

function prettyFromEmail(email?: string | null) {
  if (!email) return "";
  const left = email.split("@")[0] || "";
  if (!left) return "";
  const cleaned = left.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

export default function DashboardPage() {
  const { loading } = useTenantGate({ requireWhatsApp: false });

  const [workspaceName, setWorkspaceName] = useState<string>("Your system");
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

        // Resolve tenant_id via portal membership (auth.uid() context)
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

        // Deterministic business name from chiefos_tenants
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
          ((t as any)?.business_name as string | null) ||
          ((t as any)?.name as string | null) ||
          "";

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
      {/* Minimal padding, full width */}
      <div className="mx-auto max-w-none px-4 py-4">
        {/* tiny header row */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/45">Workspace</div>
            <div className="truncate text-sm font-semibold text-white/85">{titleLine}</div>
          </div>
          <div className="text-[11px] text-white/40">Decision Center prototype</div>
        </div>

        {/* Row 1: Ask Chief (left) + Commands (right) */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
          {/* Ask Chief hero surface */}
          <section className="rounded-2xl border border-white/10 bg-black/50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-white/55">Ask Chief</div>
                <div className="mt-1 text-sm text-white/70">
                  Ask questions. Browse your data. Stay on one screen.
                </div>
              </div>
              <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                Live
              </div>
            </div>

            <div className="mt-4">
              <AskChiefMini />
            </div>
          </section>

          {/* Commands pinned far right */}
          <div className="xl:sticky xl:top-4 h-fit">
            <AskChiefCommandsPanel />
          </div>
        </div>

        {/* Row 2: Jobs + Tools/Data */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Jobs */}
          <div className="min-w-0">
            <JobsDecisionCenterPanel title="Jobs" />
          </div>

          {/* Tools/Data */}
          <div className="min-w-0 space-y-3">
            {/* ✅ FIXED PROPS (matches your component type) */}
            <DecisionCenterNav view={view} setView={setView} />
            <DashboardDataPanel view={view} />
          </div>
        </div>
      </div>
    </main>
  );
}