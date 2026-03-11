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

export default function PendingReviewPage() {
  const gate = useTenantGate({ requireWhatsApp: false });
  const [loading, setLoading] = useState(true);
  const [busyBatchId, setBusyBatchId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<IntakeItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

      const r = await fetch(url.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load pending review.");

      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "Failed to load pending review.");
    } finally {
      setLoading(false);
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
    return Array.from(map.entries());
  }, [rows]);

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
              Low-confidence or newly uploaded drafts live here before touching canonical truth.
            </p>
          </div>

          <a
            href="/app/uploads"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            Upload receipts / voice / PDFs
          </a>
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

        {grouped.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-sm text-white/60">
            Nothing in pending review yet.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {grouped.map(([batchId, items]) => (
              <section key={batchId} className="rounded-[24px] border border-white/10 bg-black/40">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <div className="text-xs text-white/45">Batch</div>
                    <div className="mt-1 text-sm font-semibold text-white/90">{batchId}</div>
                    <div className="mt-1 text-xs text-white/50">{items.length} item(s)</div>
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

                    <a
  href={`/app/pending-review/${items
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .find((x) => ["pending_review", "uploaded", "validated", "extracted"].includes(String(x.status || "")))?.id || items[0].id}`}
  className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
>
  Open first item
</a>

                  </div>
                </div>

                <div className="divide-y divide-white/10">
                  {items.map((item) => (
                    <a
                      key={item.id}
                      href={`/app/pending-review/${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.03] transition"
                    >
                      <div className="min-w-0">
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
                        </div>

                        <div className="mt-2 truncate text-sm font-semibold text-white/90">
                          {item.source_filename || item.id}
                        </div>

                        <div className="mt-1 text-xs text-white/50">
                          {item.job_name ? `Job: ${item.job_name} • ` : ""}
                          {fmtDate(item.created_at)}
                        </div>
                      </div>

                      <div className="text-right text-xs text-white/55">
                        <div>
                          Confidence:{" "}
                          {item.confidence_score == null
                            ? "—"
                            : `${Math.round(Number(item.confidence_score) * 100)}%`}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}