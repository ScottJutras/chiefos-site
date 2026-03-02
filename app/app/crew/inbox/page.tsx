"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

type InboxItem = {
  id: string;
  log_no: number;
  type: "task" | "time";
  source: string;
  content_text: string;
  structured?: any;
  status: "submitted" | "needs_clarification" | "approved" | "rejected" | string;
  created_at: string;

  created_by_actor_id: string;
  reviewer_actor_id: string;

  // Optional (if API includes it)
  created_by_name?: string | null;
  reviewed_by_actor_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;

  source_msg_id?: string | null;
  creator_role?: string | null;
};

type InboxResp = {
  ok: true;
  role?: string | null;

  // Most common:
  items: InboxItem[];

  // Optional future-proofing: if you later return history separately
  history_items?: InboxItem[];
};

function fmtDateTime(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function fmtDateOnly(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

function shortId(x: string | null | undefined) {
  const s = String(x || "").trim();
  if (!s) return "";
  return s.length <= 10 ? s : s.slice(0, 10) + "…";
}

function displayNameFallback(name?: string | null, actorId?: string | null) {
  const n = String(name || "").trim();
  if (n) return n;
  const a = String(actorId || "").trim();
  if (!a) return "Unknown";
  return a.slice(0, 8) + "…";
}

function isPendingStatus(s: string) {
  return s === "submitted" || s === "needs_clarification";
}

function statusLabel(s: string) {
  return String(s || "").replace(/_/g, " ");
}

function reviewerActionLabel(status: string) {
  if (status === "approved") return "Approved by";
  if (status === "rejected") return "Rejected by";
  if (status === "needs_clarification") return "Clarified by";
  // If you ever add a distinct edited status later, map it here.
  // Currently "edited" is an EVENT not a log status, so we fall back:
  return "Reviewed by";
}

export default function CrewInboxPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  // pending items (what you can act on)
  const [items, setItems] = useState<InboxItem[]>([]);

  // history (completed / older)
  const [history, setHistory] = useState<InboxItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((x) => isPendingStatus(String(x.status || ""))).length,
    [items]
  );

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const data = (await apiFetch("/api/crew/inbox", { method: "GET" })) as InboxResp;

      setRole(data.role || null);

      const all = Array.isArray(data.items) ? data.items : [];

      // If backend returns mixed statuses in items, split them.
      const pending = all.filter((x) => isPendingStatus(String(x.status || "")));
      const doneFromItems = all.filter((x) => !isPendingStatus(String(x.status || "")));

      setItems(pending);

      // If backend provides history_items, prefer it, otherwise use doneFromItems.
      const hist = Array.isArray(data.history_items) ? data.history_items : doneFromItems;
      setHistory(hist);
    } catch (e: any) {
      const msg = String(e?.message || "Failed to load inbox");
      if (e?.status === 402 || msg.includes("NOT_INCLUDED")) {
        setErr("Crew Inbox requires Pro (Crew+Control).");
      } else if (e?.status === 401 || msg.includes("AUTH_REQUIRED")) {
        setErr("Session expired. Refresh and sign in again.");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, action: "approve" | "reject" | "needs-clarification") {
    setErr(null);
    setBusyId(id);

    try {
      if (action === "approve") {
        await apiFetch(`/api/crew/logs/${id}/approve`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } else if (action === "reject") {
        const reason = (window.prompt("Reason (required):", "") || "").trim();
        if (!reason) {
          setErr("Reject requires a reason.");
          setBusyId(null);
          return;
        }
        await apiFetch(`/api/crew/logs/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
      } else {
        const note = (window.prompt("Clarification note (required):", "") || "").trim();
        if (!note) {
          setErr("Needs clarification requires a note.");
          setBusyId(null);
          return;
        }
        await apiFetch(`/api/crew/logs/${id}/needs-clarification`, {
          method: "POST",
          body: JSON.stringify({ note }),
        });
      }

      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Action failed"));
    } finally {
      setBusyId(null);
    }
  }

  // --- grouping for pending: Date -> Submitter ---
  const groupedPending = useMemo(() => {
    const map = new Map<string, Map<string, InboxItem[]>>();

    for (const x of items) {
      const day = fmtDateOnly(x.created_at);
      const submitter = displayNameFallback(x.created_by_name, x.created_by_actor_id);

      if (!map.has(day)) map.set(day, new Map());
      const inner = map.get(day)!;
      if (!inner.has(submitter)) inner.set(submitter, []);
      inner.get(submitter)!.push(x);
    }

    // Sort each bucket by created_at desc
    for (const [, inner] of map) {
      for (const [k, arr] of inner) {
        inner.set(
          k,
          [...arr].sort((a, b) => (String(b.created_at || "") > String(a.created_at || "") ? 1 : -1))
        );
      }
    }

    return map;
  }, [items]);

  const historySorted = useMemo(() => {
    return [...history].sort((a, b) => (String(b.created_at || "") > String(a.created_at || "") ? 1 : -1));
  }, [history]);

  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Crew Inbox</h1>
          <div className="mt-1 text-sm text-white/70">
            {role ? `Role: ${role}` : "Role: —"} · Pending: {pendingCount}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            disabled={loading || !!busyId}
            className={[
              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
              loading || !!busyId
                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {showHistory ? "Hide completed" : "Show completed"}
          </button>

          <button
            onClick={load}
            disabled={loading || !!busyId}
            className={[
              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
              loading || !!busyId
                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {err}
        </div>
      )}

      {/* Pending */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold">Pending review</div>
          <div className="text-xs text-white/50">Grouped by date → submitter</div>
        </div>

        {loading ? (
          <div className="mt-3 text-sm text-white/70">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-3 text-sm text-white/70">No pending crew logs.</div>
        ) : (
          <div className="mt-4 grid gap-5">
            {Array.from(groupedPending.entries()).map(([day, bySubmitter]) => (
              <div key={day}>
                <div className="text-sm font-semibold text-white/80">{day}</div>

                <div className="mt-3 grid gap-4">
                  {Array.from(bySubmitter.entries()).map(([submitter, arr]) => (
                    <div key={submitter} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                      <div className="text-xs text-white/60">
                        Submitted by: <span className="text-white/80">{submitter}</span> · {arr.length} item(s)
                      </div>

                      <div className="mt-3 grid gap-3">
                        {arr.map((x) => {
                          const isBusy = busyId === x.id;
                          const submitterName = displayNameFallback(x.created_by_name, x.created_by_actor_id);

                          return (
                            <div key={x.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-semibold">
                                  <span className="text-white">#{x.log_no}</span>{" "}
                                  <span className="text-white/60">·</span>{" "}
                                  <span className="text-white">{String(x.type || "").toUpperCase()}</span>{" "}
                                  <span className="text-white/60">·</span>{" "}
                                  <span className="text-white/80">
                                    {statusLabel(String(x.status || ""))}
                                  </span>{" "}
                                  <span className="text-white/60">·</span>{" "}
                                  <span className="text-white/80">submitted by {submitterName}</span>
                                </div>
                                <div className="text-xs text-white/60">{fmtDateTime(x.created_at)}</div>
                              </div>

                              <div className="mt-2 text-base text-white">{x.content_text}</div>

                              <div className="mt-2 text-xs text-white/60">
                                Source: {x.source}
                                {x.creator_role ? ` · Creator role: ${x.creator_role}` : ""}
                                {x.source_msg_id ? ` · Msg: ${shortId(x.source_msg_id)}` : ""}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => act(x.id, "approve")}
                                  disabled={isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() => act(x.id, "reject")}
                                  disabled={isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Reject
                                </button>

                                <button
                                  onClick={() => act(x.id, "needs-clarification")}
                                  disabled={isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Needs clarification
                                </button>

                                {isBusy && <span className="self-center text-xs text-white/60">Working…</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed / History */}
      {showHistory && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-semibold">Completed activity logs</div>
            <div className="text-xs text-white/50">Most recent first</div>
          </div>

          {loading ? (
            <div className="mt-3 text-sm text-white/70">Loading…</div>
          ) : historySorted.length === 0 ? (
            <div className="mt-3 text-sm text-white/70">
              No completed logs yet (or the API is only returning pending items).
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              {historySorted.map((x) => {
                const submitterName = displayNameFallback(x.created_by_name, x.created_by_actor_id);

                // Prefer reviewed_by_name if your API returns it, otherwise fallback to reviewed_by_actor_id/reviewer_actor_id
                const reviewerName = displayNameFallback(
                  x.reviewed_by_name,
                  x.reviewed_by_actor_id || x.reviewer_actor_id
                );

                return (
                  <div key={x.id} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">
                        <span className="text-white">#{x.log_no}</span>{" "}
                        <span className="text-white/60">·</span>{" "}
                        <span className="text-white">{String(x.type || "").toUpperCase()}</span>{" "}
                        <span className="text-white/60">·</span>{" "}
                        <span className="text-white/80">{statusLabel(String(x.status || ""))}</span>{" "}
                        <span className="text-white/60">·</span>{" "}
                        <span className="text-white/80">submitted by {submitterName}</span>
                      </div>
                      <div className="text-xs text-white/60">{fmtDateTime(x.created_at)}</div>
                    </div>

                    <div className="mt-2 text-base text-white">{x.content_text}</div>

                    <div className="mt-2 text-xs text-white/60">
                      Source: {x.source}
                      {x.source_msg_id ? ` · Msg: ${shortId(x.source_msg_id)}` : ""}
                    </div>

                    <div className="mt-2 text-xs text-white/70">
                      {reviewerActionLabel(String(x.status || ""))}:{" "}
                      <span className="text-white/80">{reviewerName}</span>
                      {x.reviewed_at ? (
                        <span className="text-white/50"> · {fmtDateTime(x.reviewed_at)}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}