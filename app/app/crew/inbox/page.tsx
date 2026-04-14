"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

type InboxItem = {
  id: string;
  log_no: number;
  type: "task" | "time" | "expense" | "revenue" | string;
  source: string;
  content_text: string;
  structured?: any;
  status: "submitted" | "needs_clarification" | "approved" | "rejected" | string;
  created_at: string;

  created_by_actor_id: string;
  reviewer_actor_id: string;

  // These are optional, but your /api/crew/review/inbox already returns created_by_name
  created_by_name?: string | null;

  // optional future fields
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;

  source_msg_id?: string | null;
  creator_role?: string | null;
};

type PendingTransaction = {
  id: string;
  kind: "expense" | "revenue";
  amount_cents: number;
  description?: string | null;
  vendor?: string | null;
  category?: string | null;
  job_no?: string | null;
  occurred_at?: string | null;
  submitted_by?: string | null;
  submission_status: string;
  reviewer_note?: string | null;
  created_at: string;
};

type InboxResp = {
  ok: true;
  role?: string | null;
  items: InboxItem[];
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
    return new Date(s).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

function shortId(x: string | null | undefined) {
  const s = String(x || "").trim();
  if (!s) return "";
  return s.length <= 10 ? s : s.slice(0, 10) + "…";
}

function normalizeType(t: any) {
  const s = String(t || "").toLowerCase().trim();
  return s ? s.toUpperCase() : "—";
}

function isPendingStatus(s: string) {
  return s === "submitted" || s === "needs_clarification";
}

function displayNameFor(item: InboxItem) {
  const n = String(item.created_by_name || "").trim();
  if (n) return n;
  const a = String(item.created_by_actor_id || "").trim();
  return a ? a.slice(0, 8) + "…" : "Unknown";
}

async function patchReview(logId: string, payload: Record<string, any>): Promise<void> {
  await apiFetch(`/api/crew/review/${logId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

type GroupMode = "date_submitter" | "submitter" | "date" | "none";
type SortDir = "desc" | "asc";

export default function CrewInboxPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pending expense/revenue submissions
  const [txItems, setTxItems] = useState<PendingTransaction[]>([]);
  const [txBusyId, setTxBusyId] = useState<string | null>(null);

  // ✅ user controls
  const [groupMode, setGroupMode] = useState<GroupMode>("date_submitter");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const pendingCount = useMemo(
    () => items.filter((x) => isPendingStatus(String(x.status || ""))).length,
    [items]
  );

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      // Load crew log inbox + pending expense/revenue transactions in parallel
      const [data, txData] = await Promise.all([
        apiFetch("/api/crew/review/inbox", { method: "GET" }) as Promise<InboxResp>,
        apiFetch("/api/crew/review/expenses/pending", { method: "GET" }).catch(() => ({ items: [] })) as Promise<{ items: PendingTransaction[] }>,
      ]);

      setRole(data.role || null);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTxItems(Array.isArray(txData.items) ? txData.items : []);
    } catch (e: any) {
      const msg = String(e?.message || "Failed to load inbox");
      if (e?.status === 402 || msg.includes("NOT_INCLUDED")) {
        setErr("Crew Inbox requires Pro (Crew+Control).");
      } else if (e?.status === 401 || msg.includes("AUTH_REQUIRED")) {
        setErr("Session expired. Refresh and sign in again.");
      } else if (e?.status === 403 || msg.includes("PERMISSION_DENIED")) {
        setErr("You don’t have permission to review these logs.");
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

  function optimisticUpdate(id: string, patch: Partial<InboxItem>) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function act(id: string, action: "approve" | "reject" | "needs-clarification" | "edit") {
    setErr(null);
    setBusyId(id);

    const before = items.find((x) => x.id === id);

    try {
      if (action === "approve") {
        optimisticUpdate(id, { status: "approved" });
        await patchReview(id, { action: "approve", status: "approved" });
      } else if (action === "reject") {
        const reason = (window.prompt("Reason (required):", "") || "").trim();
        if (!reason) {
          setErr("Reject requires a reason.");
          return;
        }
        optimisticUpdate(id, { status: "rejected" });
        await patchReview(id, { action: "reject", status: "rejected", reason });
      } else if (action === "needs-clarification") {
        const note = (window.prompt("Clarification note (required):", "") || "").trim();
        if (!note) {
          setErr("Needs clarification requires a note.");
          return;
        }
        optimisticUpdate(id, { status: "needs_clarification" });
        await patchReview(id, { action: "needs_clarification", status: "needs_clarification", note });
      } else {
        const nextText = (window.prompt("Edit text (required):", before?.content_text || "") || "").trim();
        if (!nextText) {
          setErr("Edit requires text.");
          return;
        }
        optimisticUpdate(id, { content_text: nextText });
        await patchReview(id, { action: "edit", content_text: nextText });
      }

      await load();
    } catch (e: any) {
      if (before) optimisticUpdate(id, before);
      setErr(String(e?.message || "Action failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function actTx(txId: string, action: "approve" | "decline") {
    setErr(null);
    setTxBusyId(txId);
    try {
      let reviewerNote: string | undefined;
      if (action === "decline") {
        const note = (window.prompt("Decline reason (optional):", "") || "").trim();
        reviewerNote = note || undefined;
      }

      await apiFetch(`/api/crew/review/expenses/${txId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reviewer_note: reviewerNote }),
      });

      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Action failed"));
    } finally {
      setTxBusyId(null);
    }
  }

  const pending = useMemo(() => items.filter((x) => isPendingStatus(String(x.status || ""))), [items]);

  const pendingSorted = useMemo(() => {
    const arr = [...pending];
    arr.sort((a, b) => {
      const A = String(a.created_at || "");
      const B = String(b.created_at || "");
      const cmp = A < B ? -1 : A > B ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [pending, sortDir]);

  // Grouped views for pending
  const grouped = useMemo(() => {
    if (groupMode === "none") return null;

    if (groupMode === "date_submitter") {
      const map = new Map<string, Map<string, InboxItem[]>>();
      for (const x of pendingSorted) {
        const day = fmtDateOnly(x.created_at);
        const who = displayNameFor(x);
        if (!map.has(day)) map.set(day, new Map());
        const inner = map.get(day)!;
        if (!inner.has(who)) inner.set(who, []);
        inner.get(who)!.push(x);
      }
      return { mode: groupMode, map };
    }

    if (groupMode === "submitter") {
      const map = new Map<string, InboxItem[]>();
      for (const x of pendingSorted) {
        const who = displayNameFor(x);
        if (!map.has(who)) map.set(who, []);
        map.get(who)!.push(x);
      }
      return { mode: groupMode, map };
    }

    // groupMode === "date"
    const map = new Map<string, InboxItem[]>();
    for (const x of pendingSorted) {
      const day = fmtDateOnly(x.created_at);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(x);
    }
    return { mode: groupMode, map };
  }, [pendingSorted, groupMode]);

  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Crew Inbox</h1>
          <div className="mt-1 text-sm text-white/70">
            {role ? `Role: ${role}` : "Role: —"} · Pending: {pendingCount}
          </div>
        </div>

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

      {/* Controls */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-white/70">Group by</div>
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            disabled={loading || !!busyId}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="date_submitter">Date → Submitter</option>
            <option value="submitter">Submitter</option>
            <option value="date">Date</option>
            <option value="none">None</option>
          </select>

          <div className="ml-2 text-sm text-white/70">Sort by date</div>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDir)}
            disabled={loading || !!busyId}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {err}
        </div>
      )}

      {loading ? (
        <div className="mt-4 text-sm text-white/70">Loading…</div>
      ) : pendingSorted.length === 0 ? (
        <div className="mt-4 text-sm text-white/70">No pending crew logs.</div>
      ) : groupMode === "none" ? (
        <div className="mt-4 grid gap-3">
          {pendingSorted.map((x) => {
            const isBusy = busyId === x.id;
            const submitter = displayNameFor(x);
            const isPending = isPendingStatus(String(x.status || ""));

            return (
              <div key={x.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">
                    <span className="text-white">#{x.log_no}</span>{" "}
                    <span className="text-white/60">·</span>{" "}
                    <span className="text-white">{normalizeType(x.type)}</span>{" "}
                    <span className="text-white/60">·</span>{" "}
                    <span className="text-white/80">{x.status}</span>{" "}
                    <span className="text-white/60">·</span>{" "}
                    <span className="text-white/80">submitted by {submitter}</span>
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
                    disabled={!isPending || isBusy}
                    className={[
                      "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                      !isPending || isBusy
                        ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => act(x.id, "reject")}
                    disabled={!isPending || isBusy}
                    className={[
                      "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                      !isPending || isBusy
                        ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => act(x.id, "needs-clarification")}
                    disabled={!isPending || isBusy}
                    className={[
                      "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                      !isPending || isBusy
                        ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    Needs clarification
                  </button>

                  <button
                    onClick={() => act(x.id, "edit")}
                    disabled={!isPending || isBusy}
                    className={[
                      "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                      !isPending || isBusy
                        ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                        : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    Edit text
                  </button>

                  {isBusy && <span className="self-center text-xs text-white/60">Working…</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Grouped rendering
        <div className="mt-4 grid gap-5">
          {/* @ts-ignore */}
          {grouped && grouped.mode === "date_submitter" &&
            // @ts-ignore
            Array.from(grouped.map.entries()).map(([day, inner]) => (
              <div key={day}>
                <div className="text-sm font-semibold text-white/80">{day}</div>
                <div className="mt-3 grid gap-4">
                  {Array.from(inner.entries()).map(([who, arr]) => (
                    <div key={who} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                      <div className="text-xs text-white/60">
                        Submitted by: <span className="text-white/80">{who}</span> · {arr.length} item(s)
                      </div>

                      <div className="mt-3 grid gap-3">
                        {arr.map((x) => {
                          const isBusy = busyId === x.id;
                          const isPending = isPendingStatus(String(x.status || ""));
                          const submitter = displayNameFor(x);

                          return (
                            <div key={x.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="font-semibold">
                                  <span className="text-white">#{x.log_no}</span>{" "}
                                  <span className="text-white/60">·</span>{" "}
                                  <span className="text-white">{normalizeType(x.type)}</span>{" "}
                                  <span className="text-white/60">·</span>{" "}
                                  <span className="text-white/80">{x.status}</span>{" "}
                                  <span className="text-white/60">·</span>{" "}
                                  <span className="text-white/80">submitted by {submitter}</span>
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
                                  disabled={!isPending || isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    !isPending || isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() => act(x.id, "reject")}
                                  disabled={!isPending || isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    !isPending || isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Reject
                                </button>

                                <button
                                  onClick={() => act(x.id, "needs-clarification")}
                                  disabled={!isPending || isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    !isPending || isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Needs clarification
                                </button>

                                <button
                                  onClick={() => act(x.id, "edit")}
                                  disabled={!isPending || isBusy}
                                  className={[
                                    "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                                    !isPending || isBusy
                                      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                                  ].join(" ")}
                                >
                                  Edit text
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

          {/* @ts-ignore */}
          {grouped && grouped.mode === "submitter" &&
            // @ts-ignore
            Array.from(grouped.map.entries()).map(([who, arr]) => (
              <div key={who}>
                <div className="text-sm font-semibold text-white/80">{who}</div>
                <div className="mt-3 grid gap-3">
                  {arr.map((x) => {
                    const isBusy = busyId === x.id;
                    const isPending = isPendingStatus(String(x.status || ""));
                    const submitter = displayNameFor(x);

                    return (
                      <div key={x.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold">
                            <span className="text-white">#{x.log_no}</span>{" "}
                            <span className="text-white/60">·</span>{" "}
                            <span className="text-white">{normalizeType(x.type)}</span>{" "}
                            <span className="text-white/60">·</span>{" "}
                            <span className="text-white/80">{x.status}</span>{" "}
                            <span className="text-white/60">·</span>{" "}
                            <span className="text-white/80">submitted by {submitter}</span>
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
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => act(x.id, "reject")}
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Reject
                          </button>

                          <button
                            onClick={() => act(x.id, "needs-clarification")}
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Needs clarification
                          </button>

                          <button
                            onClick={() => act(x.id, "edit")}
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Edit text
                          </button>

                          {isBusy && <span className="self-center text-xs text-white/60">Working…</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {/* @ts-ignore */}
          {grouped && grouped.mode === "date" &&
            // @ts-ignore
            Array.from(grouped.map.entries()).map(([day, arr]) => (
              <div key={day}>
                <div className="text-sm font-semibold text-white/80">{day}</div>
                <div className="mt-3 grid gap-3">
                  {arr.map((x) => {
                    const isBusy = busyId === x.id;
                    const isPending = isPendingStatus(String(x.status || ""));
                    const submitter = displayNameFor(x);

                    return (
                      <div key={x.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold">
                            <span className="text-white">#{x.log_no}</span>{" "}
                            <span className="text-white/60">·</span>{" "}
                            <span className="text-white">{normalizeType(x.type)}</span>{" "}
                            <span className="text-white/60">·</span>{" "}
                            <span className="text-white/80">{x.status}</span>{" "}
                            <span className="text-white/60">·</span>{" "}
                            <span className="text-white/80">submitted by {submitter}</span>
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
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => act(x.id, "reject")}
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Reject
                          </button>

                          <button
                            onClick={() => act(x.id, "needs-clarification")}
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Needs clarification
                          </button>

                          <button
                            onClick={() => act(x.id, "edit")}
                            disabled={!isPending || isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              !isPending || isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Edit text
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
      )}

      {/* ── Pending expense/revenue submissions ── */}
      {txItems.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 text-sm font-semibold text-white/80">
            Pending expense / revenue submissions ({txItems.length})
          </div>
          <div className="grid gap-3">
            {txItems.map((tx) => {
              const isBusy = txBusyId === tx.id;
              const amountDollars = (tx.amount_cents / 100).toFixed(2);
              return (
                <div key={tx.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white capitalize">
                        {tx.kind} · ${amountDollars}
                      </div>
                      {tx.description && (
                        <div className="mt-0.5 text-sm text-white/80">{tx.description}</div>
                      )}
                      <div className="mt-1 text-xs text-white/50 flex flex-wrap gap-2">
                        {tx.vendor && <span>Vendor: {tx.vendor}</span>}
                        {tx.category && <span>Category: {tx.category}</span>}
                        {tx.job_no && <span>Job: {tx.job_no}</span>}
                        {tx.submitted_by && <span>By: {tx.submitted_by}</span>}
                        <span>{fmtDateTime(tx.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => actTx(tx.id, "approve")}
                      disabled={isBusy}
                      className={[
                        "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                        isBusy
                          ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                          : "border-green-500/30 bg-green-500/10 text-green-100 hover:bg-green-500/20",
                      ].join(" ")}
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => actTx(tx.id, "decline")}
                      disabled={isBusy}
                      className={[
                        "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                        isBusy
                          ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                          : "border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20",
                      ].join(" ")}
                    >
                      Decline
                    </button>

                    {isBusy && <span className="self-center text-xs text-white/60">Working…</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}