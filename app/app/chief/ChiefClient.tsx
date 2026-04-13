// app/app/chief/ChiefClient.tsx
"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import { useSearchParams } from "next/navigation";
import PlanGateBanner from "@/app/app/components/PlanGateBanner";

type TotalsRange = "mtd";

type OverheadContext = {
  monthly_burden_cents: number;
  item_count: number;
  items: Array<{ name: string; category: string; monthly_cents: number }>;
  still_needed_cents: number | null;
} | null;

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
  /** Partial text accumulated during SSE streaming (before done event) */
  streamText?: string;
};

function normalizeRange(r: TotalsRange) {
  return r;
}

function safeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function ChiefClientInner() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const gateLoading = gate.loading;

  const range: TotalsRange = "mtd";
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pageContext, setPageContext] = useState<PageContext>(null);
  const [overheadContext, setOverheadContext] = useState<OverheadContext>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Stable ref so postMessage handler always sees latest callAskChief
  const callRef = useRef<((p: string) => void) | null>(null);

  const searchParams = useSearchParams();
  const didAutoRunRef = useRef(false);

  // Fetch overhead context once on mount so Chief can answer overhead questions
  useEffect(() => {
    (async () => {
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
        const [oRes, txRes] = await Promise.all([
          supabase.from("overhead_items")
            .select("name, category, item_type, amount_cents, frequency, amortization_months")
            .eq("tenant_id", tenantId)
            .eq("active", true),
          supabase.from("transactions")
            .select("amount_cents")
            .eq("tenant_id", tenantId)
            .eq("kind", "revenue")
            .gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
        ]);
        const rows = (oRes.data as any[]) || [];
        const items = rows.map((r: any) => {
          let monthly_cents: number = r.amount_cents;
          if (r.item_type === "amortized") monthly_cents = r.amortization_months ? Math.round(r.amount_cents / r.amortization_months) : 0;
          else if (r.frequency === "weekly") monthly_cents = Math.round(r.amount_cents * 52 / 12);
          else if (r.frequency === "annual") monthly_cents = Math.round(r.amount_cents / 12);
          return { name: r.name, category: r.category, monthly_cents };
        });
        const monthly_burden_cents = items.reduce((s, i) => s + i.monthly_cents, 0);
        const mtd_revenue = ((txRes.data as any[]) || []).reduce((s: number, r: any) => s + (r.amount_cents || 0), 0);
        setOverheadContext({
          monthly_burden_cents,
          item_count: items.length,
          items,
          still_needed_cents: monthly_burden_cents > 0 ? Math.max(0, monthly_burden_cents - mtd_revenue) : null,
        });
      } catch {
        // fail-soft
      }
    })();
  }, []);

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
    const lc = prompt.trim().toLowerCase().replace(/[.!?]+$/, "").trim();

    // Intro / capability questions
    const isIntro =
      /\b(how can you help|what can you do|what do you do|who are you|what are you|how does this work|help me understand|what can i ask|tell me what you can do|how does ask chief work|how does chief work)\b/i.test(lc) ||
      lc === "help" || lc === "?" || lc === "menu" || lc === "how can you help me" || lc === "how it works" || lc === "how does this work";
    if (isIntro) {
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
        '  "How am I doing on this job?" — if you have a job open, I\'ll pull that job\'s data',
        "",
        "Overhead & obligations",
        '  "How much do I need to make this month to cover my overhead?"',
        '  "What are my biggest fixed costs?"',
        '  "Am I on track to cover my bills this month?"',
        "",
        "Crew & operations",
        '  "How many hours did the team log this week?"',
        '  "What\'s still in Pending Review?"',
        '  "Which tasks are overdue?"',
        "",
        "The more you log — via WhatsApp or the web portal — the more precise my answers get. What would you like to know first?",
      ].join("\n");
    }

    // How to log a transaction
    const isLogTx =
      /\b(log a transaction|log transaction|how do i log|how to log|log an expense|log revenue|add a transaction|record a transaction|record an expense)\b/i.test(lc);
    if (isLogTx) {
      return [
        "You can log transactions two ways:",
        "",
        "Via the web portal",
        "  Go to Expenses or Revenue in the left sidebar. Hit \"New\" and fill in the details. Takes about 20 seconds.",
        "",
        "Via WhatsApp",
        "  Text or voice-message your ChiefOS number. Say something like:",
        '  "Spent $240 at Home Depot for the Henderson job"',
        '  "Received $4,500 from Thompson — final invoice"',
        "  I'll parse it and log it automatically. Receipt photos work too — just send the image.",
        "",
        "The more you log, the more accurately I can answer questions about your cashflow and job profitability. Want to link your WhatsApp number?",
      ].join("\n");
    }

    // How to link WhatsApp
    const isLinkWA =
      /\b(link whatsapp|link my whatsapp|link my phone|connect whatsapp|how do i link|how to link|whatsapp number|connect my number)\b/i.test(lc);
    if (isLinkWA) {
      return [
        "Linking WhatsApp lets you log expenses, revenue, hours, and more by just sending a text or voice message — no forms needed.",
        "",
        "To link your number:",
        "  1. Go to Settings → Link WhatsApp (or tap the Link WhatsApp button below)",
        "  2. Enter your mobile number",
        "  3. You'll get a WhatsApp message with a verification code",
        "  4. Reply with the code and you're connected",
        "",
        "Once linked, text me things like:",
        '  "Bought $180 in lumber for the Oakdale job"',
        '  "Clock in Dan on the Henderson site"',
        '  "Invoice paid — $6,200 from Morrison"',
        "",
        "WhatsApp is optional — you can also log everything through the web portal. But most owners find texting faster once they\'re set up.",
      ].join("\n");
    }

    // Pricing / what's free vs paid
    const isPricing =
      /\b(what.s free|free vs paid|pricing|plans|how much does|cost|subscription|upgrade|starter|pro plan|what do i get|what.s included)\b/i.test(lc);
    if (isPricing) {
      return [
        "ChiefOS has three plans. Start with Free, upgrade when you're ready.",
        "",
        "FREE — $0/month",
        "  • Ask Chief: 10 questions/month",
        "  • Expense & revenue logging (web + WhatsApp)",
        "  • Up to 3 active jobs · up to 3 employees",
        "  • Time clock & labour hours",
        "  • CSV export · 90-day history",
        "",
        "STARTER — $59/month",
        "  • Ask Chief: 250 questions/month",
        "  • Everything in Free, plus:",
        "  • Receipt scanner (OCR) · audio logging",
        "  • Documents builder (quotes, invoices, contracts)",
        "  • Up to 25 jobs · 10 employees",
        "  • PDF & XLS exports · 3-year history",
        "",
        "PRO — $149/month",
        "  • Ask Chief: 2,000 questions/month",
        "  • Everything in Starter, plus:",
        "  • Crew self-logging via WhatsApp",
        "  • Time approvals & edit requests",
        "  • Unlimited jobs · up to 50 employees",
        "  • Up to 5 board members",
        "  • 7-year history",
        "",
        "All plans: your data is yours, export anytime. No lock-in.",
        "Upgrade at any time from Settings → Billing.",
      ].join("\n");
    }

    return null;
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
        overhead_context: overheadContext || null,
        history: history.length > 0 ? history : undefined,
      };

      // ---- SSE streaming path ----
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 35000);
      let r: Response;
      try {
        r = await fetch("/api/ask-chief/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: abortCtrl.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const ct = r.headers.get("content-type") || "";

      // Non-SSE response (e.g., plan gate JSON) — fall back to JSON parsing
      if (!ct.includes("text/event-stream")) {
        let j: any = null;
        try { j = await r.json(); } catch { j = null; }
        setPendingResp(normalizeResp(j, r.status));
        return;
      }

      // Stream SSE events
      if (!r.body) {
        setPendingResp({ ok: false, code: "ERROR", message: "Stream not supported in this browser." });
        return;
      }

      const reader  = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      const appendStreamText = (chunk: string) => {
        setMsgs((prev) =>
          prev.map((m) =>
            m.id === pendingChief.id
              ? { ...m, pending: false, streamText: (m.streamText || "") + chunk }
              : m
          )
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";  // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { streamDone = true; break; }

          let evt: any;
          try { evt = JSON.parse(raw); } catch { continue; }

          if (typeof evt.token === "string") {
            appendStreamText(evt.token);
            continue;
          }

          if (evt.done) {
            // Final event — replace streamText with the authoritative answer
            const finalResp = normalizeResp(
              { ok: evt.ok ?? true, answer: evt.answer, evidence_meta: evt.evidence_meta, warnings: evt.warnings, actions: evt.actions },
              200
            );
            setMsgs((prev) =>
              prev.map((m) =>
                m.id === pendingChief.id
                  ? { ...m, pending: false, streamText: undefined, resp: finalResp }
                  : m
              )
            );
            streamDone = true;
            break;
          }

          // Error event inside the SSE stream
          if (evt.error || evt.ok === false) {
            setPendingResp(normalizeResp(evt, 200));
            streamDone = true;
            break;
          }

          // {"status":"thinking","tools":[...]} — no UI change needed (dots still show)
        }

        if (streamDone) break;
      }

      // Post-loop safety net: if the pending bubble was never resolved
      // (stream closed without a done/error event), replace it with an error.
      setMsgs((prev) =>
        prev.map((m) =>
          m.id === pendingChief.id && (m.pending || (m.streamText !== undefined && !m.resp))
            ? {
                ...m,
                pending: false,
                streamText: undefined,
                resp: { ok: false, code: "ERROR", message: "Chief didn't respond. Try again." },
              }
            : m
        )
      );
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      const isNetwork = e?.name === "TypeError" || e?.message?.includes("fetch");
      setPendingResp({
        ok: false,
        code: "ERROR",
        message: isAbort
          ? "Chief took too long to respond. Try a shorter or more specific question."
          : isNetwork
          ? "Couldn't reach Chief — check your connection and try again."
          : (e?.message || ""),
      });
    } finally {
      setBusy(false);
      // Notify the parent frame (ChiefDock) that a question was consumed,
      // so the pull-tab quota indicator can decrement without a round-trip.
      try {
        if (typeof window !== "undefined" && window.parent !== window) {
          window.parent.postMessage({ type: "chief-quota-used" }, window.location.origin);
        }
      } catch {
        // cross-origin guard — safe to ignore
      }
    }
  }

  // Keep callRef up to date so the postMessage handler always calls the latest version
  callRef.current = callAskChief;

  function ChiefAvatar() {
    return (
      <div style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: "50%", marginTop: 1,
        background: "linear-gradient(135deg, #D4A853 0%, #C49840 55%, #9A7220 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "#0A0900",
        boxShadow: "0 0 10px rgba(212,168,83,0.3), 0 0 0 1px rgba(212,168,83,0.38), 0 2px 6px rgba(0,0,0,0.4)",
      }}>C</div>
    );
  }

  function renderChiefBubble(m: Msg) {
    if (m.pending) {
      return (
        <div className="flex items-start gap-2.5">
          <ChiefAvatar />
          <div style={{
            background: "rgba(212,168,83,0.045)", border: "1px solid rgba(212,168,83,0.16)",
            borderLeft: "2px solid rgba(212,168,83,0.45)", borderRadius: "0 12px 12px 12px",
            padding: "12px 16px", display: "flex", gap: 5, alignItems: "center",
            boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
          }}>
            {[0, 180, 360].map((delay) => (
              <span key={delay} style={{
                width: 5, height: 5, borderRadius: "50%", background: "#D4A853", opacity: 0.6,
                animation: `chiefDotBounce 1.4s ease-in-out ${delay}ms infinite`,
                boxShadow: "0 0 5px rgba(212,168,83,0.5)",
              }} />
            ))}
          </div>
        </div>
      );
    }

    // Streaming — show partial text with a blinking cursor
    if (m.streamText !== undefined && !m.resp) {
      return (
        <div className="flex items-start gap-2.5">
          <ChiefAvatar />
          <div style={{
            maxWidth: "85%", background: "rgba(212,168,83,0.045)",
            border: "1px solid rgba(212,168,83,0.16)", borderLeft: "2px solid rgba(212,168,83,0.45)",
            borderRadius: "0 12px 12px 12px", padding: "10px 13px",
            fontSize: 13, color: "#E8E2D8", lineHeight: 1.7, whiteSpace: "pre-wrap",
            boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
          }}>
            {m.streamText}
            <span style={{
              display: "inline-block", width: 2, height: 13, background: "#D4A853",
              marginLeft: 2, verticalAlign: "text-bottom",
              animation: "chiefCursorBlink 0.8s step-end infinite",
              boxShadow: "0 0 7px rgba(212,168,83,0.75)",
            }} />
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
        body = "You've used your 10 free questions this month. Upgrade to Starter for 250 questions/month, or Pro for 2,000.";
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
        body = resp.message || "Ask Chief reads your transaction ledger. Start logging expenses and revenue — via WhatsApp or the web portal — and I can answer questions about cashflow, job profit, overhead, and more.";
        actions = [
          { label: "How do I log a transaction?", onClick: () => void callAskChief("How do I log a transaction?"), kind: "primary" },
          { label: "How do I link WhatsApp?", onClick: () => void callAskChief("How do I link WhatsApp?"), kind: "secondary" },
          { label: "How does this work?", onClick: () => void callAskChief("How does Ask Chief work?"), kind: "secondary" },
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
        <div className="flex items-start gap-2.5">
          <ChiefAvatar />
          <div style={{
            maxWidth: "85%", background: "rgba(180,60,60,0.06)",
            border: "1px solid rgba(180,60,60,0.22)", borderLeft: "2px solid rgba(180,60,60,0.5)",
            borderRadius: "0 12px 12px 12px", padding: "10px 13px",
            fontSize: 13, lineHeight: 1.7, boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
          }}>
            <p style={{ color: "#c47a7a", whiteSpace: "pre-wrap" }}>{body}</p>
            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a, i) => {
                  const cls = a.kind === "primary"
                    ? "rounded-xl bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#C49843] transition"
                    : "rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1.5 text-xs text-[#D4A853] hover:bg-[rgba(212,168,83,0.14)] transition";
                  const isExternal = a.href?.startsWith("http");
                  return a.href
                    ? <a key={i} href={a.href} className={cls} target={isExternal ? "_blank" : "_top"} {...(isExternal ? { rel: "noopener noreferrer" } : {})}>{a.label}</a>
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
      <div className="flex items-start gap-2.5">
        <ChiefAvatar />
        <div className="max-w-[85%] space-y-2">
          <div style={{
            background: "rgba(212,168,83,0.045)", border: "1px solid rgba(212,168,83,0.16)",
            borderLeft: "2px solid rgba(212,168,83,0.45)", borderRadius: "0 12px 12px 12px",
            padding: "10px 13px", fontSize: 13, color: "#E8E2D8",
            lineHeight: 1.7, whiteSpace: "pre-wrap", boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
          }}>
            {ok.answer}
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
                  ? "rounded-xl bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#C49843] transition"
                  : "rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1.5 text-xs text-[#D4A853] hover:bg-[rgba(212,168,83,0.14)] transition";
                const isExternal = a.href?.startsWith("http");
                return <a key={i} href={a.href} className={cls} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{a.label}</a>;
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
        <div style={{
          maxWidth: "80%",
          background: "rgba(212,168,83,0.09)", border: "1px solid rgba(212,168,83,0.22)",
          borderRadius: "12px 12px 2px 12px", padding: "9px 13px",
          fontSize: 13, color: "#F5F0E8", lineHeight: 1.6, whiteSpace: "pre-wrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}>
          {m.prompt}
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

  const CHIPS = pageContext?.job_name ? [
    `Is ${pageContext.job_name} profitable?`,
    `What have I spent on ${pageContext.job_name}?`,
    `How many hours logged on ${pageContext.job_name}?`,
    "What did we spend this month?",
  ] : [
    "What did we spend this month?",
    "Which job is losing money?",
    "How much do I need to cover overhead?",
    "How many hours did the team log this week?",
    "What's still in Pending Review?",
  ];

  return (
    <>
      <style>{`
        @keyframes chiefDotBounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes chiefCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <main className="min-h-screen">
        <div className="mx-auto max-w-3xl py-6 px-4">
          {gate.planKey === "free" && (
            <div className="mb-6">
              <PlanGateBanner
                featureName="Ask Chief"
                availableOn="Starter and Pro"
                freeNote="Free plan includes 10 questions/month."
                upgradeUrl="/app/settings/billing"
              />
            </div>
          )}
          {msgs.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-6 text-center">
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "linear-gradient(135deg, #D4A853 0%, #C49840 55%, #9A7220 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "#0A0900",
                boxShadow: "0 0 16px rgba(212,168,83,0.35), 0 0 0 1px rgba(212,168,83,0.4)",
              }}>C</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#E8E2D8", letterSpacing: "-0.01em" }}>
                  Ask Chief anything
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "rgba(168,160,144,0.7)" }}>
                  Your financial data, on demand. Powered by your live ledger.
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => { setQ(chip); void callAskChief(chip); }}
                    style={{
                      padding: "7px 13px",
                      background: "rgba(212,168,83,0.06)", border: "1px solid rgba(212,168,83,0.28)",
                      borderRadius: 14, color: "#A8A090", fontSize: 12, cursor: "pointer",
                      transition: "all 0.15s ease", lineHeight: 1.4, textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.color = "#D4A853";
                      b.style.borderColor = "rgba(212,168,83,0.55)";
                      b.style.background = "rgba(212,168,83,0.11)";
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.color = "#A8A090";
                      b.style.borderColor = "rgba(212,168,83,0.28)";
                      b.style.background = "rgba(212,168,83,0.06)";
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {msgs.map((m) => (
                <div key={m.id}>{m.role === "user" ? renderUserBubble(m) : renderChiefBubble(m)}</div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-8">
            <div style={{
              borderRadius: 16, border: "1px solid rgba(212,168,83,0.2)",
              background: "rgba(212,168,83,0.04)", padding: "12px 14px",
            }}>
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
                      ? `Ask about ${pageContext.job_name}…`
                      : "Ask Chief anything about your business…"
                  }
                  style={{
                    flex: 1, borderRadius: 10, border: "1px solid rgba(212,168,83,0.15)",
                    background: "rgba(0,0,0,0.35)", padding: "9px 12px",
                    fontSize: 13, color: "#E8E2D8", outline: "none",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(212,168,83,0.4)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(212,168,83,0.15)"; }}
                />
                <button
                  type="submit"
                  disabled={busy || !q.trim()}
                  style={{
                    borderRadius: 10, background: "#D4A853", padding: "9px 16px",
                    fontSize: 13, fontWeight: 600, color: "#0A0900", cursor: "pointer",
                    opacity: busy || !q.trim() ? 0.45 : 1, transition: "opacity 0.15s",
                    border: "none",
                  }}
                >
                  {busy ? "Thinking…" : "Ask"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export default function ChiefClient() {
  return (
    <Suspense fallback={<div className="p-8 text-white/70">Loading Chief…</div>}>
      <ChiefClientInner />
    </Suspense>
  );
}
