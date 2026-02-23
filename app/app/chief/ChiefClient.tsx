// app/app/chief/ChiefClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import { useSearchParams } from "next/navigation";

type TotalsRange = "all" | "ytd" | "mtd" | "wtd" | "today";

type AskChiefOk = {
  ok: true;
  answer: string;
  evidence_meta: {
    range:
      | "today"
      | "wtd"
      | "mtd"
      | "ytd"
      | "all"
      | { start: string; end: string };
    job?: { id: string; name?: string } | null;
    tables?: Record<string, number>;
    totals?: {
      revenue?: number;
      expenses?: number;
      net?: number;
      hours_est?: number;
    };
  };
  warnings?: string[];
  actions?: Array<{ label: string; href: string; kind?: "primary" | "secondary" }>;
};

type AskChiefErr = {
  ok: false;
  code: "PLAN_REQUIRED" | "NOT_LINKED" | "PERMISSION_DENIED" | "AUTH_REQUIRED" | string;
  message?: string;
  required_plan?: string;
  upgrade_url?: string;
};

type AskChiefResp = AskChiefOk | AskChiefErr;

type Msg = {
  id: string;
  role: "user" | "chief";
  createdAt: number;
  prompt?: string;
  resp?: AskChiefResp;
  pending?: boolean;
};

function chip(cls: string) {
  return ["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", cls].join(
    " "
  );
}

function money(n?: number) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rangeLabel(r: TotalsRange) {
  if (r === "all") return "All";
  if (r === "ytd") return "YTD";
  if (r === "mtd") return "MTD";
  if (r === "wtd") return "WTD";
  return "Today";
}

function normalizeRange(r: TotalsRange) {
  return r;
}

function clsJoin(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
}

function safeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function StateCard({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions?: Array<{ label: string; href?: string; kind?: "primary" | "secondary" }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-2 text-sm text-white/65">{body}</div>
      {actions?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a, i) => {
            const primary = a.kind === "primary";
            const cls = primary
              ? "rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
              : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10";
            return (
              <a key={i} href={a.href || "#"} className={cls}>
                {a.label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function ChiefClient() {
  // ✅ IMPORTANT: we need more than just loading now
  const gate = useTenantGate({ requireWhatsApp: false });
  const gateLoading = gate.loading;

  // These fields exist if you used the earlier "useTenantGate drop-in" that forwards whoami fields.
  // If you haven't yet, you SHOULD update useTenantGate to include: betaPlan, betaStatus, betaEntitlementPlan.
  const betaPlan = (gate as any)?.betaPlan ?? null;
  const betaStatus = (gate as any)?.betaStatus ?? null;
  const betaEntitlementPlan = (gate as any)?.betaEntitlementPlan ?? null;

  const [range, setRange] = useState<TotalsRange>("mtd");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lastChiefResp = useMemo(() => {
    const last = [...msgs].reverse().find((m) => m.role === "chief" && m.resp && !m.pending);
    return last?.resp ?? null;
  }, [msgs]);

  const pageState = useMemo(() => {
    if (!lastChiefResp) return "unknown";
    if (lastChiefResp.ok) return "enabled";
    const code = String((lastChiefResp as any).code || "");
    if (code === "PLAN_REQUIRED") return "plan_required";
    if (code === "NOT_LINKED") return "not_linked";
    if (code === "PERMISSION_DENIED") return "permission_denied";
    if (code === "AUTH_REQUIRED") return "auth_required";
    return "error";
  }, [lastChiefResp]);

  const suggestedPrompts = useMemo(() => {
    return [
      "What did I spend this week (WTD)?",
      "Show unassigned expenses I should tag to a job.",
      "Which job has the most labor hours today?",
      "How much did I make last month?",
    ];
  }, []);

  const searchParams = useSearchParams();
  const didAutoRunRef = useRef(false);

  useEffect(() => {
    if (didAutoRunRef.current) return;
    if (gateLoading) return;

    const raw = searchParams.get("q") || "";
    const nextQ = raw.trim();
    if (!nextQ) return;

    didAutoRunRef.current = true;
    setQ(nextQ);
    void callAskChief(nextQ);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, gateLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function callAskChief(prompt: string) {
    const trimmed = String(prompt || "").trim();
    if (!trimmed || busy) return;

    setBusy(true);

    const userMsg: Msg = { id: safeId(), role: "user", createdAt: Date.now(), prompt: trimmed };
    const pendingChief: Msg = { id: safeId(), role: "chief", createdAt: Date.now(), pending: true };
    setMsgs((prev) => [...prev, userMsg, pendingChief]);

    const setPendingResp = (resp: AskChiefResp) => {
      setMsgs((prev) => prev.map((m) => (m.id === pendingChief.id ? { ...m, pending: false, resp } : m)));
    };

    const normalizeResp = (j: any, status: number): AskChiefResp => {
      if (j?.ok === false && j?.code) return j as AskChiefErr;

      if (j?.ok === true) {
        const ok: AskChiefOk = {
          ok: true,
          answer: String(j?.answer || j?.message || "Done."),
          evidence_meta: j?.evidence_meta ?? {
            range: normalizeRange(range),
            job: null,
            tables: { expenses: 0, revenue: 0, time: 0, tasks: 0, jobs: 0 },
            totals: { revenue: 0, expenses: 0, net: 0, hours_est: 0 },
          },
          warnings: Array.isArray(j?.warnings) ? j.warnings : [],
          actions: Array.isArray(j?.actions) ? j.actions : [],
        };
        return ok;
      }

      if (status === 401) return { ok: false, code: "AUTH_REQUIRED", message: "Please log in again." };
      if (status === 403) return { ok: false, code: "PERMISSION_DENIED", message: "Access denied." };
      if (status === 402)
        return { ok: false, code: "PLAN_REQUIRED", message: "Ask Chief unlocks on Starter.", upgrade_url: "/pricing" };

      return { ok: false, code: "ERROR", message: j?.error || j?.message || "Ask Chief failed." };
    };

    try {
      let token: string | null = null;
      try {
        const sess = await supabase?.auth?.getSession?.();
        token = sess?.data?.session?.access_token ?? null;
      } catch {
        token = null;
      }

      if (!token) {
        setPendingResp({ ok: false, code: "AUTH_REQUIRED", message: "Please log in again." });
        return;
      }

      const body = { prompt: trimmed, range: normalizeRange(range) };

      const r = await fetch("/api/ask-chief", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      let j: any = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      setPendingResp(normalizeResp(j, r.status));
    } catch (e: any) {
      setPendingResp({ ok: false, code: "ERROR", message: e?.message ?? "Ask Chief failed." });
    } finally {
      setBusy(false);
    }
  }

  function RangePill({ id }: { id: TotalsRange }) {
    const active = range === id;
    return (
      <button
        type="button"
        onClick={() => setRange(id)}
        className={clsJoin(
          "rounded-full border px-3 py-1 text-xs transition",
          active ? "border-white/20 bg-white text-black" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        )}
      >
        {rangeLabel(id)}
      </button>
    );
  }

  if (gateLoading) return <div className="p-8 text-white/70">Loading Chief…</div>;

  /**
   * ✅ Pre-gate: Early access states BEFORE they ask anything.
   * - requested → show waitlist
   * - not found → send to early access page
   *
   * NOTE: betaPlan only exists when approved (per whoami).
   */
  const isBetaRequested = betaStatus === "requested";
  const isBetaDenied = betaStatus === "denied";
  const isBetaApproved = !!betaPlan;

  if (!isBetaApproved && (isBetaRequested || isBetaDenied || betaStatus === null)) {
    if (isBetaRequested) {
      return (
        <main className="min-h-screen">
          <div className="mx-auto max-w-3xl py-10 px-6">
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Early Access</div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">Request received</h1>
            <p className="mt-2 text-sm text-white/65">
              You’re on the list{betaEntitlementPlan ? ` for ${String(betaEntitlementPlan).toUpperCase()}` : ""}. Once
              you’re approved, your account unlocks automatically.
            </p>

            <div className="mt-6">
              <StateCard
                title="What happens next"
                body="You already created your account. Next step is approval. Once approved, refresh and you’ll be in."
                actions={[
                  { label: "Go to Billing / Plans", href: "/pricing", kind: "secondary" },
                  { label: "Back to app", href: "/app/expenses", kind: "primary" },
                ]}
              />
            </div>
          </div>
        </main>
      );
    }

    if (isBetaDenied) {
      return (
        <main className="min-h-screen">
          <div className="mx-auto max-w-3xl py-10 px-6">
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Access</div>
            <StateCard
              title="Access not available on this email"
              body="This email isn’t approved for early access. You can request access or choose a plan."
              actions={[
                { label: "Request early access", href: "/early-access?plan=starter", kind: "primary" },
                { label: "View plans", href: "/pricing", kind: "secondary" },
              ]}
            />
          </div>
        </main>
      );
    }

    // betaStatus === null (no row found)
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl py-10 px-6">
          <div className={chip("border-white/10 bg-white/5 text-white/70")}>Chief</div>
          <StateCard
            title="Get access to ChiefOS"
            body="Your account isn’t on the early access list yet. Request access (Starter/Pro) and we’ll approve you."
            actions={[
              { label: "Request Starter access", href: "/early-access?plan=starter", kind: "primary" },
              { label: "Request Pro access", href: "/early-access?plan=pro", kind: "secondary" },
            ]}
          />
        </div>
      </main>
    );
  }

  // ✅ Normal Chief UI
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Intelligence</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Chief</h1>
            <p className="mt-1 text-sm text-white/60">
              Answers are based on your logged ledger — with scope and evidence.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => callAskChief(p)}
                  disabled={busy}
                  className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 transition disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* helpful visibility for beta */}
            <div className="mt-3 text-xs text-white/45">
              Access: {betaPlan ? `Beta approved (${String(betaPlan).toUpperCase()})` : "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/55">Default range</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <RangePill id="all" />
              <RangePill id="ytd" />
              <RangePill id="mtd" />
              <RangePill id="wtd" />
              <RangePill id="today" />
            </div>
          </div>
        </div>

        {msgs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="text-sm font-semibold text-white/90">Ask a real question</div>
            <div className="mt-2 text-sm text-white/65">
              Try: “Which job is losing money this week?” or “Show unassigned expenses I should tag.”
            </div>

            {pageState !== "unknown" && pageState !== "enabled" ? (
              <div className="mt-4 text-xs text-white/55">
                You’ll see a gate card after your first request if your plan/permissions/linking aren’t ready.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {msgs.map((m) => (
              <div key={m.id}>
                {m.role === "user" ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/55">You</div>
                    <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{m.prompt}</div>
                  </div>
                ) : (
                  // preserve your original bubble renderer by simply using the existing resp mapping logic
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <div className="text-xs text-white/55">Chief</div>
                    <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap">
                      {m.pending ? "Chief is checking your ledger…" : (m.resp as any)?.answer || (m.resp as any)?.message}
                    </div>
                    {m.resp && (m.resp as any)?.code === "PLAN_REQUIRED" ? (
                      <div className="mt-3 text-xs text-white/60">
                        If you’re approved for beta but still seeing this, we need core to honor beta entitlements (next
                        drop-in below).
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await callAskChief(q);
            setQ("");
          }}
          className="mt-8"
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs text-white/60 mb-2">Ask Chief</label>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g., Are we making money on Medway Park (WTD)?"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
              />
              <button
                type="submit"
                disabled={busy || !q.trim()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
              >
                {busy ? "Checking…" : "Ask"}
              </button>
            </div>

            <div className="mt-2 text-[11px] text-white/45">
              Chief answers from your logged ledger and always shows the scope used.
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}