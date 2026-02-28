"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

type InboxItem = {
  id: string;
  log_no: number;
  type: "task" | "time";
  source: string;
  content_text: string;
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
    const d = new Date(s);
    return d.toLocaleString();
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

  const pendingCount = useMemo(() => {
    return items.filter((x) => x.status === "submitted" || x.status === "needs_clarification").length;
  }, [items]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = (await apiFetch("/api/crew/inbox", { method: "GET" })) as InboxResp;
      setRole(data.role || null);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      const msg = String(e?.message || "Failed to load inbox");
      // Pro gate surfaces as 402 from backend
      if (String(msg).includes("NOT_INCLUDED") || e?.status === 402) {
        setErr("Crew Inbox requires Pro (Crew+Control).");
      } else if (String(msg).includes("AUTH_REQUIRED") || e?.status === 401) {
        setErr("Session expired. Please refresh and sign in again.");
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
      } else if (action === "needs-clarification") {
        const note = window.prompt("Clarification note (optional):", "") || "";
        await apiFetch(`/api/crew/logs/${id}/needs-clarification`, {
          method: "POST",
          body: JSON.stringify({ note }),
        });
      }

      // Refresh after mutation
      await load();
    } catch (e: any) {
      const msg = String(e?.message || "Action failed");
      setErr(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Crew Inbox</h1>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            {role ? `Role: ${role}` : "Role: —"} · Pending: {pendingCount}
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading || !!busyId}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: loading || !!busyId ? "not-allowed" : "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {err && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,0,0,0.25)",
            background: "rgba(255,0,0,0.06)",
          }}
        >
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 18, opacity: 0.7 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 18, opacity: 0.7 }}>No pending crew logs.</div>
      ) : (
        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {items.map((x) => {
            const isBusy = busyId === x.id;
            const isPending = x.status === "submitted" || x.status === "needs_clarification";

            return (
              <div
                key={x.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 14,
                  padding: 14,
                  background: "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>
                    #{x.log_no} · {x.type.toUpperCase()} · {x.status}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 13 }}>{fmtDate(x.created_at)}</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 15 }}>{x.content_text}</div>

                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
                  Source: {x.source}
                  {x.creator_role ? ` · Creator role: ${x.creator_role}` : ""}
                  {x.source_msg_id ? ` · Msg: ${x.source_msg_id.slice(0, 10)}…` : ""}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => act(x.id, "approve")}
                    disabled={!isPending || isBusy}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: isPending ? "white" : "rgba(0,0,0,0.04)",
                      cursor: !isPending || isBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => act(x.id, "reject")}
                    disabled={!isPending || isBusy}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: isPending ? "white" : "rgba(0,0,0,0.04)",
                      cursor: !isPending || isBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => act(x.id, "needs-clarification")}
                    disabled={!isPending || isBusy}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: isPending ? "white" : "rgba(0,0,0,0.04)",
                      cursor: !isPending || isBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Needs clarification
                  </button>

                  {isBusy && <div style={{ opacity: 0.7, alignSelf: "center" }}>Working…</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}