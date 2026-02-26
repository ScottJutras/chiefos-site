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

        // Resolve tenant_id via portal membership
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

        // Read business name from chiefos_tenants (deterministic)
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
      <div className="mx-auto max-w-6xl px-4 py-5">
        {/* Tight header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] text-white/45">Workspace</div>
            <div className="truncate text-base font-semibold text-white/90">{titleLine}</div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <TopLink href="/app/settings/billing" label="Billing" />
            <TopLink href="/app/settings" label="Settings" />
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* LEFT: fill the space (hero + data) */}
          <div className="min-w-0">
            {/* Ask Chief HERO */}
            <section className="rounded-3xl border border-white/10 bg-black/50 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    Decision Centre
                  </div>

                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white/90">
                    Ask Chief
                  </h1>
                  <p className="mt-1 text-sm text-white/60">
                    Ask real business questions. Chief answers from your ledger and shows the scope used.
                  </p>
                </div>

                {/* Optional: tiny indicator area (keeps it “system” not “chat app”) */}
                <div className="hidden sm:block text-right">
                  <div className="text-[11px] text-white/45">Mode</div>
                  <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                    Grounded answers
                  </div>
                </div>
              </div>

              {/* Ask Chief input component */}
              <div className="mt-5">
                {/* NOTE: AskChiefMini currently has “Open Chief →” + prompt chips.
                   Next patch: make AskChiefMini render ONLY input + Ask button (no link/buttons).
                   But even before that patch, this layout makes it feel like the hero. */}
                <AskChiefMini />
              </div>

              {/* In-page nav row (tabs/links that don’t leave dashboard) */}
              <div className="mt-4">
                <DecisionCenterNav view={view} setView={setView} />
              </div>
            </section>

            {/* Data panel directly under Ask Chief (fills left column) */}
            <section className="mt-4 rounded-3xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/55">Data</div>
                <div className="text-[11px] text-white/40">
                  Browse while you ask — no page switching.
                </div>
              </div>

              <div className="mt-3">
                <DashboardDataPanel view={view} />
              </div>
            </section>

            <div className="mt-3 text-[11px] text-white/35">
              Tip: keep this screen open while logging in WhatsApp — you’ll see the ledger populate.
            </div>
          </div>

          {/* RIGHT: sticky stack */}
          <aside className="space-y-4 xl:sticky xl:top-4 h-fit">
            <div id="command-reference">
              <AskChiefCommandsPanel />
            </div>
            <JobsDecisionCenterPanel title="Jobs" />
          </aside>
        </div>
      </div>
    </main>
  );
}