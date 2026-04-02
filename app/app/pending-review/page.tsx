"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";

type IntakeItem = {
  id: string;
  batch_id: string;
  kind: string;
  status: string;
  source_filename: string | null;
  mime_type: string | null;
  draft_type: string | null;
  confidence_score: number | null;
  job_name: string | null;
  created_at: string;

  draft_amount_cents?: number | null;
  draft_currency?: string | null;
  draft_vendor?: string | null;
  draft_description?: string | null;
  draft_event_date?: string | null;
  draft_job_name?: string | null;
  draft_validation_flags?: string[];
  fast_confirm_ready?: boolean;
};

type IntakeListResponse = {
  ok: true;
  rows: IntakeItem[];
  meta?: {
    total: number;
    fastConfirmReady: number;
  };
};

type OverheadReminder = {
  id: string;
  item_id: string;
  item_name: string;
  period_year: number;
  period_month: number;
  amount_cents: number;
  tax_amount_cents: number | null;
  status: string;
  created_at: string;
};

function fmtDate(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function kindLabel(kind?: string | null) {
  if (kind === "receipt_image") return "Receipt";
  if (kind === "voice_note") return "Voice";
  if (kind === "pdf_document") return "PDF";
  return "Unknown";
}

function confidencePct(score?: number | null) {
  if (score == null) return "—";
  return `${Math.round(Number(score) * 100)}%`;
}

function normalizeFlags(flags?: string[] | null) {
  return Array.isArray(flags) ? flags.filter(Boolean) : [];
}

function flagLabel(flag: string) {
  return String(flag || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isReadyForOneTapConfirm(item: IntakeItem) {
  return Boolean(item.fast_confirm_ready);
}

function compareItemsForReview(a: IntakeItem, b: IntakeItem) {
  const aReady = isReadyForOneTapConfirm(a) ? 1 : 0;
  const bReady = isReadyForOneTapConfirm(b) ? 1 : 0;

  if (aReady !== bReady) return bReady - aReady;

  const aScore = Number(a.confidence_score || 0);
  const bScore = Number(b.confidence_score || 0);
  if (aScore !== bScore) return bScore - aScore;

  return new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime();
}

function pickBestBatchItem(items: IntakeItem[]) {
  const sorted = [...items].sort(compareItemsForReview);
  return sorted[0] || null;
}

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return "—";
  const code = String(currency || "USD").toUpperCase();

  try {
    return (Number(cents) / 100).toLocaleString(undefined, {
      style: "currency",
      currency: code,
    });
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${code}`;
  }
}

export default function PendingReviewPage() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const [loading, setLoading] = useState(true);
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);
  const [busyDeleteItemId, setBusyDeleteItemId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<IntakeItem[]>([]);
  const [meta, setMeta] = useState<IntakeListResponse["meta"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reminders, setReminders] = useState<OverheadReminder[]>([]);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || "";
    if (!token) throw new Error("Missing session.");
    return { Authorization: `Bearer ${token}` };
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const headers = await authHeader();
      const url = new URL("/api/intake/items", window.location.origin);
      url.searchParams.set("status", "pending_review");
      if (q.trim()) url.searchParams.set("q", q.trim());

      const [intakeRes, remindersRes] = await Promise.all([
        fetch(url.toString(), { method: "GET", headers, cache: "no-store" }),
        (async () => {
          const { supabase: sb } = await import("@/lib/supabase");
          const { data: u } = await sb.auth.getUser();
          if (!u?.user) return [];
          const { data: pu } = await sb.from("chiefos_portal_users").select("tenant_id").eq("user_id", u.user.id).maybeSingle();
          if (!pu?.tenant_id) return [];
          const now = new Date();
          const { data } = await sb.from("overhead_reminders")
            .select("*")
            .eq("tenant_id", pu.tenant_id)
            .eq("status", "pending")
            .eq("period_year", now.getFullYear())
            .eq("period_month", now.getMonth() + 1)
            .order("created_at");
          return (data || []) as OverheadReminder[];
        })(),
      ]);

      const j = (await intakeRes.json().catch(() => ({}))) as Partial<IntakeListResponse> & { ok?: boolean; error?: string };
      if (!intakeRes.ok || !j?.ok) throw new Error(j?.error || "Failed to load pending review.");

      setRows(Array.isArray(j.rows) ? j.rows : []);
      setMeta(j.meta || null);
      setReminders(await remindersRes);
    } catch (e: any) {
      setRows([]);
      setMeta(null);
      setErr(e?.message || "Failed to load pending review.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmReminder(reminderId: string, action: "confirm" | "skip") {
    setBusyReminderId(reminderId);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const r = await fetch("/api/overhead/confirm-reminder", {
        method: "POST", headers,
        body: JSON.stringify({ reminder_id: reminderId, action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || "Failed");
      setReminders((prev) => prev.filter((rem) => rem.id !== reminderId));
    } catch (e: any) {
      setErr(e?.message || "Failed to update reminder.");
    } finally {
      setBusyReminderId(null);
    }
  }

  async function processBatch(batchId: string) {
    setBusyBatchId(batchId);
    setErr(null);
    try {
      const headers = {
        ...(await authHeader()),
        "Content-Type": "application/json",
      };

      const r = await fetch("/api/intake/process", {
        method: "POST",
        headers,
        body: JSON.stringify({ batchId }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to process batch.");

      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to process batch.");
    } finally {
      setBusyBatchId(null);
    }
  }

  async function deleteItem(itemId: string) {
    setBusyDeleteItemId(itemId);
    setErr(null);
    try {
      const headers = {
        ...(await authHeader()),
        "Content-Type": "application/json",
      };

      const r = await fetch(`/api/intake/items/${encodeURIComponent(itemId)}/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ comment: "Deleted from Pending Review queue." }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Delete failed.");

      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed.");
    } finally {
      setBusyDeleteItemId(null);
    }
  }

  useEffect(() => {
    if (gate.loading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.loading]);

  const grouped = useMemo(() => {
    const map = new Map<string, IntakeItem[]>();
    for (const row of rows) {
      const key = row.batch_id;
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }

    return Array.from(map.entries())
      .map(([batchId, items]) => [batchId, [...items].sort(compareItemsForReview)] as const)
      .sort((a, b) => {
        const bestA = pickBestBatchItem(a[1]);
        const bestB = pickBestBatchItem(b[1]);
        if (!bestA && !bestB) return 0;
        if (!bestA) return 1;
        if (!bestB) return -1;
        return compareItemsForReview(bestA, bestB);
      });
  }, [rows]);

  const totalReady = useMemo(
    () =>
      meta?.fastConfirmReady ??
      rows.filter((item) => isReadyForOneTapConfirm(item)).length,
    [rows, meta]
  );

  if (gate.loading || loading) {
    return <div className="p-8 text-white/70">Loading Pending Review…</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-white/45">Owner review</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pending Review</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
              Drafts live here before they can touch canonical truth.
            </p>
          </div>

          <a
            href="/app/uploads"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            Upload receipts / voice / PDFs
          </a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Items in queue</div>
            <div className="mt-2 text-2xl font-semibold">{meta?.total ?? rows.length}</div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="text-xs text-emerald-200/70">Ready for one-tap confirm</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-100">{totalReady}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/45">Needs deeper review</div>
            <div className="mt-2 text-2xl font-semibold">
              {Math.max((meta?.total ?? rows.length) - totalReady, 0)}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search filename, OCR text, transcript, job…"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none md:max-w-xl"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {/* Overhead payment confirmations */}
        {reminders.length > 0 && (
          <section className="mt-6 rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-amber-400/70">Overhead payments — confirm or skip</div>
            <div className="space-y-2">
              {reminders.map((rem) => {
                const total = rem.amount_cents + (rem.tax_amount_cents || 0);
                const busy  = busyReminderId === rem.id;
                const monthName = new Date(rem.period_year, rem.period_month - 1).toLocaleString(undefined, { month: "long", year: "numeric" });
                return (
                  <div key={rem.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white/85">{rem.item_name}</div>
                      <div className="text-xs text-white/45">
                        {monthName} · ${(total / 100).toFixed(2)}{rem.tax_amount_cents ? " incl. tax" : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirmReminder(rem.id, "confirm")}
                        className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-40"
                      >
                        {busy ? "…" : "Yes, paid ✓"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirmReminder(rem.id, "skip")}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10 transition disabled:opacity-40"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {grouped.length === 0 && reminders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-sm text-white/60">
            Nothing in pending review yet.
          </div>
        ) : grouped.length === 0 ? null : (
          <div className="mt-6 space-y-5">
            {grouped.map(([batchId, items]) => {
              const bestItem = pickBestBatchItem(items);
              const readyCount = items.filter((item) => isReadyForOneTapConfirm(item)).length;

              return (
                <section key={batchId} className="rounded-[24px] border border-white/10 bg-black/40">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                      <div className="text-xs text-white/45">Batch</div>
                      <div className="mt-1 text-sm font-semibold text-white/90">{batchId}</div>
                      <div className="mt-1 text-xs text-white/50">
                        {items.length} item(s) • {readyCount} ready now
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void processBatch(batchId)}
                        disabled={busyBatchId === batchId}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                      >
                        {busyBatchId === batchId ? "Processing…" : "Re-process batch"}
                      </button>

                      {bestItem ? (
                        <a
                          href={`/app/pending-review/${bestItem.id}`}
                          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                        >
                          {isReadyForOneTapConfirm(bestItem) ? "One-tap confirm next" : "Open best next item"}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {items.map((item) => {
                      const ready = isReadyForOneTapConfirm(item);
                      const flags = normalizeFlags(item.draft_validation_flags);
                      const displayJob = String(item.draft_job_name || item.job_name || "").trim();

                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.03] transition"
                        >
                          <a
                            href={`/app/pending-review/${item.id}`}
                            className="min-w-0 flex-1"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                                {kindLabel(item.kind)}
                              </span>
                              <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60">
                                {item.status}
                              </span>
                              {item.draft_type ? (
                                <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60">
                                  {item.draft_type}
                                </span>
                              ) : null}
                              {ready ? (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                                  Ready now
                                </span>
                              ) : null}
                              {flags.length > 0 && !ready ? (
                                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
                                  {flags.length} flag{flags.length === 1 ? "" : "s"}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 truncate text-sm font-semibold text-white/90">
                              {item.source_filename || item.id}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
                              {displayJob ? <span>Job: {displayJob}</span> : null}
                              {item.draft_vendor ? <span>Vendor: {item.draft_vendor}</span> : null}
                              {item.draft_event_date ? <span>Date: {item.draft_event_date}</span> : null}
                              {item.draft_amount_cents != null ? (
                                <span>Amount: {money(item.draft_amount_cents, item.draft_currency)}</span>
                              ) : null}
                              <span>{fmtDate(item.created_at)}</span>
                            </div>

                            {flags.length > 0 && !ready ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {flags.slice(0, 3).map((flag) => (
                                  <span
                                    key={flag}
                                    className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/50"
                                  >
                                    {flagLabel(flag)}
                                  </span>
                                ))}
                                {flags.length > 3 ? (
                                  <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/50">
                                    +{flags.length - 3} more
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </a>

                          <div className="flex shrink-0 flex-col items-end gap-2 text-right text-xs text-white/55">
                            <div>Confidence: {confidencePct(item.confidence_score)}</div>
                            <div className="text-white/40">
                              {ready ? "Fast confirm path" : "Needs review"}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const ok = window.confirm("Delete this upload from the active queue?");
                                if (!ok) return;
                                void deleteItem(item.id);
                              }}
                              disabled={busyDeleteItemId === item.id}
                              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15 transition disabled:opacity-50"
                            >
                              {busyDeleteItemId === item.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}