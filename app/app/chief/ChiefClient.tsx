// app/app/chief/ChiefClient.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  actions?: Array<{ label: string; onClick?: () => void; href?: string; kind?: "primary" | "secondary" }>;
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

            if (a.href) {
              return (
                <a key={i} href={a.href} className={cls}>
                  {a.label}
                </a>
              );
            }

            return (
              <button key={i} onClick={a.onClick} className={cls}>
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ChiefClientInner() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const gateLoading = gate.loading;

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
      "How can you help me?",
      "Are we making money this month?",
      "Which jobs are profitable right now?",
      "What should I be paying attention to?",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateLoading, searchParams]);

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
            tables: { expenses: 0, revenue: 0, time: 0, tasks: 0, jobs: 0 },
            totals: { revenue: 0, expenses: 0, net: 0, hours_est: 0 },
          },
          warnings: Array.isArray(j?.warnings) ? j.warnings : [],
          actions: Array.isArray(j?.actions) ? j.actions : [],
        };
        return ok;
      }

      // Back-compat: some older handlers may return {answer:"..."} without ok
      if (j?.answer && !("ok" in j)) {
        const ok: AskChiefOk = {
          ok: true,
          answer: String(j.answer),
          evidence_meta: {
            range: normalizeRange(range),
            job: null,
            tables: { expenses: 0, revenue: 0, time: 0, tasks: 0, jobs: 0 },
            totals: { revenue: 0, expenses: 0, net: 0, hours_est: 0 },
          },
          warnings: ["Ask Chief response was auto-normalized (missing ok/evidence_meta)."],
          actions: [],
        };
        return ok;
      }

      if (status === 401) return { ok: false, code: "AUTH_REQUIRED", message: "Please log in again." };
      if (status === 403) return { ok: false, code: "PERMISSION_DENIED", message: "Access denied." };
    if (status === 402)
  return {
    ok: false,
    code: "PLAN_REQUIRED",
    message: "Ask Chief unlocks on Starter.",
    upgrade_url: "/app/settings/billing",
  };

if (j?.code === "UPSTREAM_TIMEOUT") {
  return {
    ok: false,
    code: "UPSTREAM_TIMEOUT",
    message: j?.message || "I’m having trouble reasoning right now. Your data is safe. Try again.",
  };
}

return { ok: false, code: "ERROR", message: j?.error || j?.message || "Ask Chief failed." };
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
          active
            ? "border-white/20 bg-white text-black"
            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        )}
      >
        {rangeLabel(id)}
      </button>
    );
  }

  function renderChiefBubble(m: Msg) {
  if (m.pending) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="text-xs text-white/55">Chief</div>
        <div className="mt-2 space-y-2">
          <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="mt-3 text-xs text-white/40">Chief is checking your ledger…</div>
      </div>
    );
  }

  const resp = m.resp;
  if (!resp) return null;

  // Find the most recent user prompt before this Chief message.
  const chiefIdx = msgs.findIndex((x) => x.id === m.id);
  const retryPrompt =
    chiefIdx > 0
      ? [...msgs.slice(0, chiefIdx)].reverse().find((x) => x.role === "user")?.prompt?.trim() || ""
      : "";

  if (resp.ok === false) {
    if (resp.code === "PLAN_REQUIRED") {
      return (
        <StateCard
          title="Ask Chief unlocks on Starter"
          body="Chief can answer from your real ledger, but Ask Chief is available on Starter and above."
          actions={[
            {
              label: "Go to Billing",
              href: resp.upgrade_url || "/app/settings/billing",
              kind: "primary",
            },
            { label: "See plans", href: "/pricing", kind: "secondary" },
          ]}
        />
      );
    }

    if (resp.code === "UPSTREAM_TIMEOUT" || resp.code === "UPSTREAM_ERROR") {
      return (
        <StateCard
          title="Chief is taking longer than expected"
          body="Your data is safe. This usually resolves on the next try — Chief may have been reasoning across a large dataset."
          actions={[
            ...(retryPrompt
              ? [
                  {
                    label: "Try again",
                    onClick: () => void callAskChief(retryPrompt),
                    kind: "primary" as const,
                  },
                ]
              : []),
            { label: "Back to app", href: "/app/expenses", kind: "secondary" },
          ]}
        />
      );
    }

    if (resp.code === "NOT_LINKED") {
      return (
        <StateCard
          title="WhatsApp required to use Ask Chief"
          body={resp.message || "Ask Chief reads your transaction ledger, which is built by logging through WhatsApp. Link your phone to start."}
          actions={[
            { label: "Link WhatsApp", href: "/app/link-phone", kind: "primary" },
            { label: "Back to app", href: "/app/expenses", kind: "secondary" },
          ]}
        />
      );
    }

    if (resp.code === "PERMISSION_DENIED") {
      return (
        <StateCard
          title="You don’t have access to Ask Chief"
          body="Ask the owner or a board member to grant you access."
          actions={[{ label: "Back to app", href: "/app/expenses", kind: "secondary" }]}
        />
      );
    }

    if (resp.code === "AUTH_REQUIRED") {
      return (
        <StateCard
          title="Session expired"
          body="Please log in again to continue."
          actions={[{ label: "Log in", href: "/login", kind: "primary" }]}
        />
      );
    }

    return (
      <StateCard
        title="Chief couldn’t answer that"
        body={
          resp.message && resp.message !== "Ask Chief failed."
            ? resp.message
            : "Something went wrong on my end — not yours. Try asking again, or rephrase the question slightly."
        }
        actions={[
          ...(retryPrompt
            ? [
                {
                  label: "Try again",
                  onClick: () => void callAskChief(retryPrompt),
                  kind: "primary" as const,
                },
              ]
            : []),
          { label: "Back to app", href: "/app/expenses", kind: "secondary" },
        ]}
      />
    );
  }

  const ok = resp as AskChiefOk;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="text-xs text-white/55">Chief</div>
        <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{ok.answer}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold text-white/85">Scope & Evidence</div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-white/70">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-white/45">Range</div>
            <div className="mt-1 text-white/85">
              {typeof ok.evidence_meta?.range === "string"
                ? ok.evidence_meta.range.toUpperCase()
                : `${ok.evidence_meta.range.start} → ${ok.evidence_meta.range.end}`}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="text-white/45">Job</div>
            <div className="mt-1 text-white/85">
              {ok.evidence_meta?.job?.name || ok.evidence_meta?.job?.id || "All jobs"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3 md:col-span-2">
            <div className="text-white/45">Rows scanned</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(ok.evidence_meta?.tables || {}).length ? (
                Object.entries(ok.evidence_meta.tables || {}).map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75"
                  >
                    {k}: <b className="text-white">{v}</b>
                  </span>
                ))
              ) : (
                <span className="text-white/55">—</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3 md:col-span-2">
            <div className="text-white/45">Totals (computed server-side)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {ok.evidence_meta?.totals ? (
                <>
                  {"revenue" in ok.evidence_meta.totals ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                      Revenue: <b className="text-white">${money(ok.evidence_meta.totals.revenue)}</b>
                    </span>
                  ) : null}
                  {"expenses" in ok.evidence_meta.totals ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                      Expenses: <b className="text-white">${money(ok.evidence_meta.totals.expenses)}</b>
                    </span>
                  ) : null}
                  {"net" in ok.evidence_meta.totals ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                      Net: <b className="text-white">${money(ok.evidence_meta.totals.net)}</b>
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-white/55">—</span>
              )}
            </div>

            <div className="mt-2 text-[11px] text-white/45">
              Totals reflect the full filtered ledger (not just what’s visible on screen).
            </div>
          </div>
        </div>
      </div>

      {ok.warnings?.length ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-xs font-semibold text-white/85">Warnings</div>
          <ul className="mt-2 space-y-1 text-xs text-white/70 list-disc pl-5">
            {ok.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {ok.actions?.length ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-xs font-semibold text-white/85">Next best actions</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ok.actions.slice(0, 7).map((a, i) => {
              const primary = a.kind === "primary";
              const cls = primary
                ? "rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90"
                : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10";
              return (
                <a key={i} href={a.href} className={cls}>
                  {a.label}
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

  function renderUserBubble(m: Msg) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-white/55">You</div>
        <div className="mt-2 text-sm text-white/90 whitespace-pre-wrap">{m.prompt}</div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  await callAskChief(q);
  setQ("");
}

if (gateLoading) return <div className="p-8 text-white/70">Loading Chief…</div>;

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

          {pageState !== "unknown" && pageState !== "enabled" ? (
            <div className="mt-3 text-xs text-white/45">
              Access is enforced server-side. If something’s blocked, you’ll see a clear gate card after a request.
            </div>
          ) : null}
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
        </div>
      ) : (
        <div className="mt-8 space-y-3">
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

export default function ChiefClient() {
  // ✅ Next.js requires useSearchParams() usage inside Suspense
  return (
    <Suspense fallback={<div className="p-8 text-white/70">Loading Chief…</div>}>
      <ChiefClientInner />
    </Suspense>
  );
}