// app/app/chief/ChiefClient.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import { useSearchParams } from "next/navigation";

type TotalsRange = "all" | "ytd" | "mtd" | "wtd" | "today";

type PageContext = {
  page?: string | null;
  job_id?: number | string | null;
  job_name?: string | null;
  job_no?: number | string | null;
} | null;

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
  actions?: Array<{ label: string; href: string; kind?: "primary" | "secondary" }>;
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
  return ["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", cls].join(" ");
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

function ChiefClientInner() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const gateLoading = gate.loading;

  const [range, setRange] = useState<TotalsRange>("mtd");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pageContext, setPageContext] = useState<PageContext>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Stable ref so postMessage handler always sees latest callAskChief
  const callRef = useRef<((p: string) => void) | null>(null);

  const lastChiefResp = useMemo(() => {
    const last = [...msgs].reverse().find((m) => m.role === "chief" && m.resp && !m.pending);
    return last?.resp ?? null;
  }, [msgs]);

  // Context-aware suggested prompts
  const suggestedPrompts = useMemo(() => {
    if (pageContext?.job_name) {
      return [
        `How am I doing on ${pageContext.job_name}?`,
        `Is ${pageContext.job_name} profitable right now?`,
        `What have I spent on ${pageContext.job_name}?`,
        `What's the revenue on ${pageContext.job_name}?`,
      ];
    }
    return [
      "How can you help me?",
      "Are we making money this month?",
      "Which jobs are profitable right now?",
      "What should I be paying attention to?",
    ];
  }, [pageContext]);

  const searchParams = useSearchParams();
  const didAutoRunRef = useRef(false);

  // Listen for postMessage from parent ChiefDock (context updates + quick prompts)
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "chief-context" && e.data.pageContext) {
        setPageContext(e.data.pageContext);
      }
      if (e.data?.type === "chief-prompt" && e.data.prompt) {
        callRef.current?.(e.data.prompt);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateLoading, searchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  function getInstantAnswer(prompt: string): string | null {
    const lc = prompt.trim().toLowerCase().replace(/[.!?]+$/, "");
    const isIntro =
      /\b(how can you help|what can you do|what do you do|who are you|what are you|how does this work|help me understand|what can i ask|tell me what you can do)\b/i.test(lc) ||
      lc === "help" || lc === "?" || lc === "menu" || lc === "how can you help me";
    if (!isIntro) return null;
    return [
      "I'm Chief — your on-call CFO. I read your live transaction ledger and give you straight answers about where the money is going, which jobs are profitable, and what needs your attention.",
      "",
      "Here's what you can ask me:",
      "",
      "Financial position",
      '  "What did we spend this month?"',
      '  "How much revenue came in this week?"',
      '  "Are we up or down vs. last month?"',
      "",
      "Job profitability",
      '  "Is [job name] making money?"',
      '  "Which jobs are losing money right now?"',
      '  "How am I doing on [job name]?" — if you have a job open, just ask "How am I doing on this job?"',
      "",
      "Crew & operations",
      '  "How many hours did the team log this week?"',
      '  "What\'s still in Pending Review?"',
      '  "Which tasks are overdue?"',
      "",
      "The more you log through WhatsApp — expenses, revenue, time — the more precise my answers get. What would you like to know first?",
    ].join("\n");
  }

  async function callAskChief(prompt: string) {
    const trimmed = String(prompt || "").trim();
    if (!trimmed || busy) return;

    setQ("");

    const userMsg: Msg = { id: safeId(), role: "user", createdAt: Date.now(), prompt: trimmed };

    // Instant client-side answers for conversational/intro questions
    const instant = getInstantAnswer(trimmed);
    if (instant) {
      const chiefMsg: Msg = {
        id: safeId(),
        role: "chief",
        createdAt: Date.now(),
        resp: {
          ok: true,
          answer: instant,
          evidence_meta: { range: normalizeRange(range), job: null, tables: {}, totals: {} },
          warnings: [],
          actions: [],
        },
      };
      setMsgs((prev) => [...prev, userMsg, chiefMsg]);
      return;
    }

    setBusy(true);

    const pendingChief: Msg = { id: safeId(), role: "chief", createdAt: Date.now(), pending: true };
    setMsgs((prev) => [...prev, userMsg, pendingChief]);

    const setPendingResp = (resp: AskChiefResp) => {
      setMsgs((prev) =>
        prev.map((m) => (m.id === pendingChief.id ? { ...m, pending: false, resp } : m))
      );
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
            tables: {},
            totals: {},
          },
          warnings: Array.isArray(j?.warnings) ? j.warnings : [],
          actions: Array.isArray(j?.actions) ? j.actions : [],
        };
        return ok;
      }

      // Back-compat: older responses without ok field
      if (j?.answer && !("ok" in j)) {
        const ok: AskChiefOk = {
          ok: true,
          answer: String(j.answer),
          evidence_meta: { range: normalizeRange(range), job: null, tables: {}, totals: {} },
          warnings: [],
          actions: [],
        };
        return ok;
      }

      if (status === 401) return { ok: false, code: "AUTH_REQUIRED", message: "Please log in again." };
      if (status === 403) return { ok: false, code: "PERMISSION_DENIED", message: "Access denied." };
      if (status === 402) return {
        ok: false, code: "PLAN_REQUIRED",
        message: "Ask Chief unlocks on Starter.",
        upgrade_url: "/app/settings/billing",
      };

      if (j?.code === "UPSTREAM_TIMEOUT") {
        return { ok: false, code: "UPSTREAM_TIMEOUT", message: j?.message || "" };
      }

      return { ok: false, code: "ERROR", message: j?.error || j?.message || "" };
    };

    try {
      let token: string | null = null;
      try {
        const sess = await supabase.auth.getSession();
        token = sess?.data?.session?.access_token ?? null;
      } catch {
        token = null;
      }

      if (!token) {
        setPendingResp({ ok: false, code: "AUTH_REQUIRED", message: "Please log in again." });
        return;
      }

      // Build conversation history to send (last 5 user+chief pairs, text only)
      const currentMsgs = [...msgs, userMsg];
      const history = currentMsgs
        .filter((m) => !m.pending && (m.role === "user" ? !!m.prompt : m.resp?.ok))
        .slice(-10)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.role === "user"
            ? (m.prompt || "")
            : ((m.resp as AskChiefOk)?.answer || ""),
        }))
        .filter((m) => m.content.trim());

      const body = {
        prompt: trimmed,
        range: normalizeRange(range),
        page_context: pageContext || null,
        history: history.length > 0 ? history : undefined,
      };

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
      const isNetwork = e?.name === "TypeError" || e?.message?.includes("fetch");
      setPendingResp({
        ok: false,
        code: "ERROR",
        message: isNetwork
          ? "Couldn't reach Chief — check your connection and try again."
          : (e?.message || ""),
      });
    } finally {
      setBusy(false);
    }
  }

  // Keep callRef up to date so the postMessage handler always calls the latest version
  callRef.current = callAskChief;

  function RangePill({ id }: { id: TotalsRange }) {
    const active = range === id;
    return (
      <button
        type="button"
        onClick={() => setRange(id)}
        className={clsJoin(
          "rounded-full border px-3 py-1 text-xs transition",
          active
            ? "border-white/20 bg-white text-black"
            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        )}
      >
        {rangeLabel(id)}
      </button>
    );
  }

  function ChiefAvatar() {
    return (
      <div className="shrink-0 w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[11px] font-bold text-white/70 mt-0.5">
        C
      </div>
    );
  }

  function renderChiefBubble(m: Msg) {
    if (m.pending) {
      return (
        <div className="flex items-start gap-2">
          <ChiefAvatar />
          <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      );
    }

    const resp = m.resp;
    if (!resp) return null;

    const chiefIdx = msgs.findIndex((x) => x.id === m.id);
    const retryPrompt =
      chiefIdx > 0
        ? [...msgs.slice(0, chiefIdx)].reverse().find((x) => x.role === "user")?.prompt?.trim() || ""
        : "";

    if (resp.ok === false) {
      let body = "";
      let actions: Array<{ label: string; href?: string; onClick?: () => void; kind?: "primary" | "secondary" }> = [];

      if (resp.code === "PLAN_REQUIRED") {
        body = "Ask Chief is available on Starter and above — upgrade to unlock financial insights, job profitability, and more.";
        actions = [
          { label: "Upgrade to Starter", href: resp.upgrade_url || "/app/settings/billing", kind: "primary" },
          { label: "See what's included", href: "/pricing", kind: "secondary" },
        ];
      } else if (resp.code === "UPSTREAM_TIMEOUT") {
        const msg = resp.message && resp.message.length > 10
          ? resp.message
          : "That question took longer than my time limit. Try narrowing it — add a date range (MTD, WTD) or a specific job name so I can answer faster.";
        body = msg;
        if (retryPrompt) actions.push({ label: "Try again", onClick: () => void callAskChief(retryPrompt), kind: "primary" });
      } else if (resp.code === "UPSTREAM_ERROR") {
        body = "I hit an error on my end — your data is safe. Try again in a moment.";
        if (retryPrompt) actions.push({ label: "Try again", onClick: () => void callAskChief(retryPrompt), kind: "primary" });
      } else if (resp.code === "NOT_LINKED") {
        body = resp.message || "Ask Chief reads your transaction ledger, which gets built when you log expenses and revenue through WhatsApp. Link your number to start — once you have data logged, I can answer questions about cashflow, job profit, and more.";
        actions = [
          { label: "Link WhatsApp", href: "/app/link-phone", kind: "primary" },
          { label: "How it works", href: "https://usechiefos.com/#faq", kind: "secondary" },
        ];
      } else if (resp.code === "PERMISSION_DENIED") {
        body = "You don't have permission to use Ask Chief on this account. If you think this is wrong, ask the account owner to check your role.";
      } else if (resp.code === "AUTH_REQUIRED") {
        body = "Your session expired — log in again and I'll be right here.";
        actions = [{ label: "Log in", href: "/login", kind: "primary" }];
      } else {
        // Generic error — never a dead end
        const hasMsg = resp.message && resp.message.length > 5;
        body = hasMsg
          ? resp.message!
          : "Something went wrong on my end — not yours. Try asking again, or rephrase your question.";
        if (retryPrompt) actions.push({ label: "Try again", onClick: () => void callAskChief(retryPrompt), kind: "primary" });
        actions.push({ label: "Ask differently", onClick: () => setQ(retryPrompt), kind: "secondary" });
      }

      // Merge any server-side actions
      if (Array.isArray((resp as any).actions)) {
        for (const a of (resp as any).actions) {
          if (!actions.some((x) => x.label === a.label)) actions.push(a);
        }
      }

      return (
        <div className="flex items-start gap-2">
          <ChiefAvatar />
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-sm text-white/70">{body}</p>
            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a, i) => {
                  const cls = a.kind === "primary"
                    ? "rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
                    : "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10";
                  return a.href
                    ? <a key={i} href={a.href} className={cls}>{a.label}</a>
                    : <button key={i} onClick={a.onClick} className={cls}>{a.label}</button>;
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    const ok = resp as AskChiefOk;

    return (
      <div className="flex items-start gap-2">
        <ChiefAvatar />
        <div className="max-w-[85%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{ok.answer}</p>
          </div>

          {ok.warnings?.filter(w => !w.includes("auto-normalized")).length ? (
            <p className="pl-1 text-[11px] text-white/40 italic">
              {ok.warnings.filter(w => !w.includes("auto-normalized")).join(" · ")}
            </p>
          ) : null}

          {ok.actions?.length ? (
            <div className="flex flex-wrap gap-2 pl-1">
              {ok.actions.slice(0, 5).map((a, i) => {
                const cls = a.kind === "primary"
                  ? "rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
                  : "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10";
                return <a key={i} href={a.href} className={cls}>{a.label}</a>;
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderUserBubble(m: Msg) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-white/10 border border-white/15 px-4 py-3">
          <p className="text-sm text-white/90 whitespace-pre-wrap">{m.prompt}</p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await callAskChief(q);
    setQ("");
  }

  if (gateLoading) return <div className="p-8 text-white/70">Loading Chief…</div>;

  const contextHint = pageContext?.job_name
    ? `Viewing: ${pageContext.job_name}`
    : null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={chip("border-white/10 bg-white/5 text-white/70")}>Intelligence</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Chief</h1>
            <p className="mt-1 text-sm text-white/60">
              {contextHint
                ? `Context: ${contextHint} · Answers pull from your live ledger.`
                : "Answers are based on your logged ledger — with scope and evidence."}
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
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-lg font-bold text-white/70">
              C
            </div>
            <div>
              <div className="text-sm font-semibold text-white/80">
                {pageContext?.job_name
                  ? `Ask me anything about ${pageContext.job_name}`
                  : "Ask Chief anything"}
              </div>
              <div className="mt-1 text-xs text-white/45">
                {pageContext?.job_name
                  ? `Try: "Is this job profitable?" or "What have I spent on ${pageContext.job_name}?"`
                  : 'Try: "Which job is losing money?" or "What did we spend this month?"'}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {msgs.map((m) => (
              <div key={m.id}>{m.role === "user" ? renderUserBubble(m) : renderChiefBubble(m)}</div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label htmlFor="ask-chief-input" className="block mb-2 text-xs text-white/60">
              Ask Chief
            </label>

            <div className="flex gap-2">
              <input
                id="ask-chief-input"
                name="askChief"
                type="text"
                autoComplete="off"
                enterKeyHint="send"
                aria-label="Ask Chief"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  pageContext?.job_name
                    ? `e.g., Is ${pageContext.job_name} profitable?`
                    : "e.g., Are we making money on Medway Park (WTD)?"
                }
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
              />

              <button
                type="submit"
                disabled={busy || !q.trim()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
              >
                {busy ? "Thinking…" : "Ask"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function ChiefClient() {
  return (
    <Suspense fallback={<div className="p-8 text-white/70">Loading Chief…</div>}>
      <ChiefClientInner />
    </Suspense>
  );
}
