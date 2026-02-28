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
  source_msg_id?: string | null;
  creator_role?: string | null;
};

type InboxResp = {
  ok: true;
  role?: string | null;
  items: InboxItem[];
};

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function CrewInboxPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => items.filter((x) => x.status === "submitted" || x.status === "needs_clarification").length,
    [items]
  );

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = (await apiFetch("/api/crew/inbox", { method: "GET" })) as InboxResp;
      setRole(data.role || null);
      setItems(Array.isArray(data.items) ? data.items : []);
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
        await apiFetch(`/api/crew/logs/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
      } else if (action === "reject") {
        const reason = window.prompt("Reason (optional):", "") || "";
        await apiFetch(`/api/crew/logs/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
      } else {
        const note = window.prompt("Clarification note (optional):", "") || "";
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

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {err}
        </div>
      )}

      {loading ? (
        <div className="mt-4 text-sm text-white/70">Loading…</div>
      ) : items.length === 0 ? (
        <div className="mt-4 text-sm text-white/70">No pending crew logs.</div>
      ) : (
        <div className="mt-4 grid gap-3">
          {items.map((x) => {
            const isBusy = busyId === x.id;
            const isPending = x.status === "submitted" || x.status === "needs_clarification";

            return (
              <div
                key={x.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">
                    <span className="text-white">#{x.log_no}</span>{" "}
                    <span className="text-white/60">·</span>{" "}
                    <span className="text-white">{String(x.type || "").toUpperCase()}</span>{" "}
                    <span className="text-white/60">·</span>{" "}
                    <span className="text-white/80">{x.status}</span>
                  </div>
                  <div className="text-xs text-white/60">{fmtDate(x.created_at)}</div>
                </div>

                <div className="mt-2 text-base text-white">{x.content_text}</div>

                <div className="mt-2 text-xs text-white/60">
                  Source: {x.source}
                  {x.creator_role ? ` · Creator role: ${x.creator_role}` : ""}
                  {x.source_msg_id ? ` · Msg: ${x.source_msg_id.slice(0, 10)}…` : ""}
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

                  {isBusy && <span className="self-center text-xs text-white/60">Working…</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}