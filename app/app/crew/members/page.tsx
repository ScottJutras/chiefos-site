"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiFetch";

type Member = {
  actor_id: string;
  role: "owner" | "admin" | "employee" | "board" | string;
  created_at: string;
  display_name?: string | null;
  phone_digits?: string | null;
  email?: string | null;
};

type AssignmentRow = {
  employee_actor_id: string;
  board_actor_id: string;
  active: boolean;
};

type Assignment = Record<string, string>; // employee_actor_id -> board_actor_id

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function DIGITS(x: string) {
  return String(x || "").replace(/\D/g, "");
}

/**
 * Canada/US convenience:
 * - 10 digits => assume +1 (NANP) and store "1XXXXXXXXXX"
 * - 11 digits starting with "1" => store as-is
 * - otherwise => reject (until you add country selector)
 */
function normalizePhoneDigitsOrThrow(input: string) {
  const d = DIGITS(String(input || "").trim());
  if (!d) return "";
  if (d.length === 10) return "1" + d;
  if (d.length === 11 && d.startsWith("1")) return d;

  throw new Error("Phone must be 10 digits (Canada/US) or include country code (e.g., 1XXXXXXXXXX).");
}

export default function CrewMembersPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Member[]>([]);

  // Add employee form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // ✅ DB-backed assignment map (loaded from /admin/assignments)
  const [assign, setAssign] = useState<Assignment>({});

  const employees = useMemo(() => items.filter((m) => m.role === "employee"), [items]);
  const board = useMemo(
    () => items.filter((m) => m.role === "board" || m.role === "owner" || m.role === "admin"),
    [items]
  );

  const employeeCount = employees.length;
  const boardCount = items.filter((m) => m.role === "board").length;

  async function loadMembersAndAssignments() {
    setErr(null);
    setLoading(true);
    try {
      const r = (await apiFetch("/api/crew/admin/members", { method: "GET" })) as any;
      const members: Member[] = Array.isArray(r?.items) ? r.items : [];
      setItems(members);

      // ✅ Load assignments (truth) AFTER members
      const a = (await apiFetch("/api/crew/admin/assignments", { method: "GET" })) as any;
      const rows: AssignmentRow[] = Array.isArray(a?.items) ? a.items : [];
      const map: Assignment = {};
      for (const row of rows) {
        if (row?.employee_actor_id && row?.board_actor_id) {
          map[String(row.employee_actor_id)] = String(row.board_actor_id);
        }
      }
      setAssign(map);
    } catch (e: any) {
      const msg = String(e?.message || "Unable to load members");
      if (e?.status === 402 || msg.includes("NOT_INCLUDED")) {
        setErr("Crew+Control requires Pro.");
      } else if (e?.status === 403 || msg.includes("PERMISSION_DENIED")) {
        setErr("Only the owner/admin can manage crew members.");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembersAndAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeMember(actorId: string) {
    setErr(null);
    const ok = window.confirm("Remove this member from your business? This cannot be undone.");
    if (!ok) return;

    setBusy(actorId);
    try {
      await apiFetch(`/api/crew/admin/members/${actorId}`, { method: "DELETE" });
      await loadMembersAndAssignments();
    } catch (e: any) {
      setErr(String(e?.message || "Unable to remove member"));
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    window.location.href = `/api/crew/admin/members/export.csv`;
  }

  async function addEmployee() {
    setErr(null);

    const dn = name.trim();
    const em = email.trim().toLowerCase();

    let pd = "";
    try {
      pd = normalizePhoneDigitsOrThrow(phone);
    } catch (e: any) {
      return setErr(String(e?.message || "Invalid phone number."));
    }

    if (!dn) return setErr("Display name is required.");
    if (!pd && !em) return setErr("Phone or email is required.");

    setBusy("add");
    try {
      await apiFetch("/api/crew/admin/members", {
        method: "POST",
        body: JSON.stringify({
          display_name: dn,
          phone: pd || null,
          email: em || null,
        }),
      });

      setName("");
      setPhone("");
      setEmail("");
      await loadMembersAndAssignments();
    } catch (e: any) {
      setErr(String(e?.message || "Unable to add employee"));
    } finally {
      setBusy(null);
    }
  }

  async function setRole(actorId: string, role: "employee" | "board" | "admin") {
    setErr(null);
    setBusy(actorId);
    try {
      await apiFetch(`/api/crew/admin/members/${actorId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await loadMembersAndAssignments();
    } catch (e: any) {
      setErr(String(e?.message || "Unable to update role"));
    } finally {
      setBusy(null);
    }
  }

  async function assignReviewer(employeeActorId: string, boardActorId: string) {
    setErr(null);
    setBusy(employeeActorId);
    try {
      await apiFetch(`/api/crew/admin/assign`, {
        method: "POST",
        body: JSON.stringify({
          employee_actor_id: employeeActorId,
          board_actor_id: boardActorId,
        }),
      });

      // ✅ optimistic update, but still reflects DB after refresh
      setAssign((prev) => ({ ...prev, [employeeActorId]: boardActorId }));
    } catch (e: any) {
      setErr(String(e?.message || "Unable to assign reviewer"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Members & Board</h1>
          <div className="mt-1 text-sm text-white/70">
            Employees: {employeeCount}/150 · Board: {boardCount}/25
          </div>
        </div>

        <Link
          href="/app/crew"
          className="rounded-xl px-3 py-1.5 text-sm font-medium transition border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
        >
          Back
        </Link>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {err}
        </div>
      )}

      {/* Add employee */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="font-semibold">Add employee</div>
        <div className="mt-1 text-sm text-white/70">Name + phone or email. This creates an employee actor under this tenant.</div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input
            id="crew_display_name"
            name="crew_display_name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name (required)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
          <input
            id="crew_phone"
            name="crew_phone"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (digits preferred)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
          <input
            id="crew_email"
            name="crew_email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
        </div>

        <div className="mt-3">
          <button
            onClick={addEmployee}
            disabled={loading || busy === "add"}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium transition border",
              loading || busy === "add"
                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {busy === "add" ? "Adding…" : "Add employee"}
          </button>
        </div>
      </div>

      {/* Members list */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold">Team</div>

          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              disabled={loading || !!busy}
              className={[
                "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                loading || !!busy
                  ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                  : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              Export CSV
            </button>

            <button
              onClick={loadMembersAndAssignments}
              disabled={loading || !!busy}
              className={[
                "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                loading || !!busy
                  ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                  : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 text-sm text-white/70">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-3 text-sm text-white/70">No members yet.</div>
        ) : (
          <div className="mt-3 grid gap-3">
            {items.map((m) => {
              const isBusy = busy === m.actor_id;
              const canChangeRole = m.role !== "owner";

              return (
                <div key={m.actor_id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">
                        {m.display_name || "Unnamed"}
                        <span className="text-white/60"> · </span>
                        <span className="text-white/80">{m.role}</span>
                      </div>

                      <div className="mt-1 text-xs text-white/60">
                        {m.phone_digits ? `📱 ${m.phone_digits}` : ""}
                        {m.phone_digits && m.email ? " · " : ""}
                        {m.email ? `✉️ ${m.email}` : ""}
                      </div>

                      <div className="mt-1 text-xs text-white/50">Added: {fmtDate(m.created_at)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canChangeRole && (
                        <>
                          <button
                            onClick={() => setRole(m.actor_id, "employee")}
                            disabled={isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Set employee
                          </button>

                          <button
                            onClick={() => setRole(m.actor_id, "board")}
                            disabled={isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Make board
                          </button>

                          <button
                            onClick={() => setRole(m.actor_id, "admin")}
                            disabled={isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                            ].join(" ")}
                          >
                            Make admin
                          </button>

                          <button
                            onClick={() => removeMember(m.actor_id)}
                            disabled={isBusy}
                            className={[
                              "rounded-xl px-3 py-1.5 text-sm font-medium transition border",
                              isBusy
                                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                : "border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white",
                            ].join(" ")}
                          >
                            Remove
                          </button>
                        </>
                      )}

                      {isBusy && <span className="self-center text-xs text-white/60">Working…</span>}
                    </div>
                  </div>

                  {/* Assignment row (only for employees) */}
                  {m.role === "employee" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="text-xs text-white/60">Reviewer:</div>
                      <select
                        value={assign[m.actor_id] || ""}
                        onChange={(e) => {
                          const v = String(e.target.value || "");
                          if (!v) return;
                          assignReviewer(m.actor_id, v);
                        }}
                        disabled={!!busy}
                        className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                      >
                        <option value="">Select board/admin/owner…</option>
                        {board.map((b) => (
                          <option key={b.actor_id} value={b.actor_id}>
                            {(b.display_name || b.email || b.phone_digits || b.actor_id.slice(0, 8)) + ` (${b.role})`}
                          </option>
                        ))}
                      </select>

                      <div className="text-xs text-white/50">
                        This controls where this employee’s WhatsApp logs route for approval.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}