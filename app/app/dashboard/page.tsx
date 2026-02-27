"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantGate } from "@/lib/useTenantGate";
import { supabase } from "@/lib/supabase";

import AskChiefMini from "@/app/app/components/AskChiefMini";
import AskChiefCommandsPanel from "@/app/app/components/AskChiefCommandsPanel";
import JobsDecisionCenterPanel from "@/app/app/components/JobsDecisionCenterPanel";

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

function pickBestName({
  tenantName,
  metaFallback,
  emailFallback,
}: {
  tenantName?: string | null;
  metaFallback?: string | null;
  emailFallback?: string | null;
}) {
  const a = String(tenantName ?? "").trim();
  if (a) return a;

  const b = String(metaFallback ?? "").trim();
  if (b) return b;

  const c = String(emailFallback ?? "").trim();
  if (c) return c;

  return "Your system";
}

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

        // If not logged in (or token is missing), just show best fallback
        if (!userId) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        // Resolve tenant_id via portal membership
        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (puErr) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        const tenantId = (pu as any)?.tenant_id as string | null;

        if (!tenantId) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        // Deterministic name from chiefos_tenants
        // ✅ IMPORTANT: do NOT select business_name (it does not exist / causes 400)
        const { data: t, error: tErr } = await supabase
          .from("chiefos_tenants")
          .select("name")
          .eq("id", tenantId)
          .maybeSingle();

        if (tErr) {
          if (alive) setWorkspaceName(pickBestName({ metaFallback, emailFallback }));
          return;
        }

        const tenantName = ((t as any)?.name as string | null) || null;

        if (alive) {
          setWorkspaceName(
            pickBestName({
              tenantName,
              metaFallback,
              emailFallback,
            })
          );
        }
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
      <div className="mx-auto max-w-none px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/45">Workspace</div>
            <div className="truncate text-sm font-semibold text-white/85">{titleLine}</div>
          </div>
          <div className="text-[11px] text-white/40">Decision Center prototype</div>
        </div>

        <div className="mt-5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_420px]">
          <section className="place-self-start h-fit w-full rounded-2xl border border-white/10 bg-black/60 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-white/50">Ask Chief</div>
                <div className="text-sm text-white/70">Ask about spend, revenue, profit, jobs.</div>
              </div>

              <div className="hidden sm:block text-[11px] text-white/40">Live</div>
            </div>

            <div className="mt-3">
              <AskChiefMini />
            </div>
          </section>

          <div className="xl:sticky xl:top-4 h-fit">
            <AskChiefCommandsPanel />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0">
            <JobsDecisionCenterPanel title="Jobs" />
          </div>

          <div className="min-w-0 space-y-3">
            <DecisionCenterNav view={view} setView={setView} />
            <DashboardDataPanel view={view} />
          </div>
        </div>
      </div>
    </main>
  );
}