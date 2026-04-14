"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiFetch";
import { supabase } from "@/lib/supabase";

type Member = {
  actor_id: string;
  role: "owner" | "admin" | "employee" | "board" | string;
  created_at: string;
  display_name?: string | null;
  phone_digits?: string | null;
  email?: string | null;
};

type InviteRow = {
  id: string;
  token: string;
  employee_name: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  expires_at: string;
  claimed_at?: string | null;
  created_at: string;
};

type AssignmentRow = {
  employee_actor_id: string;
  board_actor_id: string;
  active: boolean;
};

type Assignment = Record<string, string>; // employee_actor_id -> board_actor_id

type RateMap = Record<string, number>; // employee display_name -> hourly_rate_cents

type Quota = {
  plan_key: string;
  employees_used: number;
  employees_limit: number;
  board_used: number;
  board_limit: number;
};

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

  // Allow blank (since email can be used)
  if (!d) return "";

  if (d.length === 10) return "1" + d;
  if (d.length === 11 && d.startsWith("1")) return d;

  throw new Error(
    "Phone must be 10 digits (Canada/US) or include country code (e.g., 1XXXXXXXXXX)."
  );
}

export default function CrewMembersPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Member[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

  // Add employee form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Invite form
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"employee" | "board">("employee");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; name: string } | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  // Reviewer routing map (NOW hydrated from DB)
  const [assign, setAssign] = useState<Assignment>({});
  // Hourly rates keyed by display_name
  const [rates, setRates] = useState<RateMap>({});
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({}); // in-progress edits
  const [rateBusy, setRateBusy] = useState<string | null>(null);
  const [tenantCountry, setTenantCountry] = useState<string>("CA");

  const employees = useMemo(() => items.filter((m) => m.role === "employee"), [items]);
  const board = useMemo(
    () => items.filter((m) => m.role === "board" || m.role === "owner" || m.role === "admin"),
    [items]
  );

  const employeeCount = employees.length;
  const boardCount = items.filter((m) => m.role === "board").length;

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      // Load members + assignments + invites in parallel
      const [membersResp, assignmentsResp, invitesResp] = await Promise.all([
        apiFetch("/api/crew/admin/members", { method: "GET" }) as Promise<any>,
        apiFetch("/api/crew/admin/assignments", { method: "GET" }) as Promise<any>,
        apiFetch("/api/crew/admin/invites", { method: "GET" }).catch(() => ({ items: [] })) as Promise<any>,
      ]);
      setInvites(Array.isArray(invitesResp?.items) ? invitesResp.items : []);

      const members = Array.isArray(membersResp?.items) ? (membersResp.items as Member[]) : [];
      setItems(members);
      if (membersResp?.quota) setQuota(membersResp.quota as Quota);

      const rows = Array.isArray(assignmentsResp?.items)
        ? (assignmentsResp.items as AssignmentRow[])
        : [];

      // Hydrate assign map from DB
      const nextMap: Assignment = {};
      for (const r of rows) {
        if (!r) continue;
        if (r.active && r.employee_actor_id && r.board_actor_id) {
          nextMap[String(r.employee_actor_id)] = String(r.board_actor_id);
        }
      }
      setAssign(nextMap);

      // Load tenant country + hourly rates in parallel
      const { data: puRow } = await supabase
        .from("chiefos_portal_users")
        .select("tenant_id")
        .limit(1)
        .maybeSingle();

      if (puRow?.tenant_id) {
        const { data: tenantRow } = await supabase
          .from("chiefos_tenants")
          .select("country")
          .eq("id", puRow.tenant_id)
          .maybeSingle();
        if (tenantRow?.country) setTenantCountry(String(tenantRow.country).toUpperCase());
      }

      const { data: rateRows } = await supabase
        .from("chiefos_crew_rates")
        .select("employee_name, hourly_rate_cents")
        .order("effective_from", { ascending: false });

      const rateMap: RateMap = {};
      for (const r of (rateRows ?? [])) {
        const name = String(r.employee_name || "").trim();
        if (name && !(name in rateMap)) {
          rateMap[name] = Number(r.hourly_rate_cents || 0);
        }
      }
      setRates(rateMap);
    } catch (e: any) {
      const msg = String(e?.message || "Unable to load members");
      if (e?.status === 403 || msg.includes("PERMISSION_DENIED")) {
        setErr("Only the owner/admin can manage crew members.");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(actorId: string) {
    setErr(null);

    const ok = window.confirm("Remove this member from your business? This cannot be undone.");
    if (!ok) return;

    setBusy(actorId);
    try {
      await apiFetch(`/api/crew/admin/members/${actorId}`, { method: "DELETE" });

      // also remove local assignment mapping if present
      setAssign((prev) => {
        const next = { ...prev };
        delete next[actorId];
        return next;
      });

      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Unable to remove member"));
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv() {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      if (!token) { setErr("Not authenticated."); return; }
      const r = await fetch("/api/crew/admin/members/export.csv", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { setErr("Export failed."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "crew_members.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Export failed.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await load();
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

      // If demoting someone, you may want to refresh assignments (server deactivates board->employee routing)
      await load();
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

      // optimistic local reflect (still useful)
      setAssign((prev) => ({ ...prev, [employeeActorId]: boardActorId }));
    } catch (e: any) {
      setErr(String(e?.message || "Unable to assign reviewer"));
    } finally {
      setBusy(null);
    }
  }

  async function sendInvite() {
    setErr(null);
    setInviteResult(null);

    const dn = inviteName.trim();
    const em = inviteEmail.trim().toLowerCase();

    let pd = "";
    try {
      pd = normalizePhoneDigitsOrThrow(invitePhone);
    } catch (e: any) {
      return setErr(String(e?.message || "Invalid phone number."));
    }

    if (!dn) return setErr("Employee name is required for invite.");
    if (!pd && !em) return setErr("Phone or email is required to send invite.");

    setInviteBusy(true);
    try {
      const resp = await apiFetch("/api/crew/admin/invite", {
        method: "POST",
        body: JSON.stringify({
          employee_name: dn,
          phone: pd || null,
          email: em || null,
          role: inviteRole,
        }),
      }) as any;

      setInviteResult({ url: resp.item.inviteUrl, name: dn });
      setInviteName("");
      setInvitePhone("");
      setInviteEmail("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || "Unable to send invite"));
    } finally {
      setInviteBusy(false);
    }
  }

  async function saveRate(displayName: string) {
    const raw = String(rateEdits[displayName] ?? "").trim();
    if (!raw) return;
    const dollars = Number(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(dollars) || dollars < 0) return setErr("Invalid rate.");
    const cents = Math.round(dollars * 100);

    setRateBusy(displayName);
    try {
      // Resolve tenant_id for the current user
      const { data: pu } = await supabase
        .from("chiefos_portal_users")
        .select("tenant_id")
        .limit(1)
        .maybeSingle();
      const tenantId = pu?.tenant_id;
      if (!tenantId) throw new Error("Could not resolve tenant.");

      const { error } = await supabase
        .from("chiefos_crew_rates")
        .upsert(
          {
            tenant_id: tenantId,
            employee_name: displayName,
            hourly_rate_cents: cents,
            currency: tenantCountry === "US" ? "USD" : "CAD",
            effective_from: new Date().toISOString().slice(0, 10),
          },
          { onConflict: "tenant_id,employee_name,effective_from" }
        );
      if (error) throw error;
      setRates((prev) => ({ ...prev, [displayName]: cents }));
      setRateEdits((prev) => { const next = { ...prev }; delete next[displayName]; return next; });
    } catch (e: any) {
      setErr(String(e?.message || "Failed to save rate."));
    } finally {
      setRateBusy(null);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Members & Board</h1>
          <div className="mt-1 text-sm text-white/70">
            {quota ? (
              <>
                Employees: <span className={employeeCount >= quota.employees_limit ? "text-amber-400 font-medium" : ""}>{employeeCount}/{quota.employees_limit}</span>
                {quota.board_limit > 0 && <> · Board: {boardCount}/{quota.board_limit}</>}
                {" · "}
                <span className="capitalize">{quota.plan_key}</span>
              </>
            ) : (
              <>Employees: {employeeCount} · Board: {boardCount}</>
            )}
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
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold">Add employee</div>
          {quota && employeeCount >= quota.employees_limit && (
            <span className="text-xs text-amber-400">
              {quota.plan_key === "free"
                ? "Free plan: 3 employee max · Upgrade to Starter for 25"
                : quota.plan_key === "starter"
                ? "Starter plan: 25 employee max · Upgrade to Pro for 150"
                : "Employee limit reached"}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-white/70">
          Name + phone or email. This creates an employee actor under this tenant.
        </div>

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
            disabled={loading || busy === "add" || (quota != null && employeeCount >= quota.employees_limit)}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium transition border",
              loading || busy === "add" || (quota != null && employeeCount >= quota.employees_limit)
                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {busy === "add" ? "Adding…" : "Add employee"}
          </button>
        </div>
      </div>

      {/* Send invite link */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="font-semibold">Send portal invite</div>
        <div className="mt-1 text-sm text-white/70">
          Send an SMS link so employees can log into the web portal (PWA). Phone or email required.
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Employee name (required)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
          <input
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            placeholder="Phone (for SMS)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email (optional)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "employee" | "board")}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
          >
            <option value="employee">Employee</option>
            <option value="board">Board member</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={sendInvite}
            disabled={inviteBusy}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium transition border",
              inviteBusy
                ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {inviteBusy ? "Sending…" : "Send invite"}
          </button>

          {inviteResult && (
            <div className="flex-1 text-xs text-white/70 break-all">
              Invite sent to <strong>{inviteResult.name}</strong>.{" "}
              <span className="text-white/40">Link: </span>
              <a
                href={inviteResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D4A853] hover:underline"
              >
                {inviteResult.url}
              </a>
            </div>
          )}
        </div>

        {/* Recent invites */}
        {invites.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-xs text-white/50 mb-2">Recent invites</div>
            <div className="grid gap-1.5">
              {invites.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
                  <span>
                    <span className="text-white/80">{inv.employee_name}</span>
                    {" · "}
                    {inv.role}
                    {inv.phone ? ` · ${inv.phone}` : ""}
                    {inv.email ? ` · ${inv.email}` : ""}
                  </span>
                  <span className={inv.claimed_at ? "text-green-400" : new Date(inv.expires_at) < new Date() ? "text-red-400" : "text-white/40"}>
                    {inv.claimed_at ? "Claimed" : new Date(inv.expires_at) < new Date() ? "Expired" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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
              onClick={load}
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
              const canChangeRole = m.role !== "owner"; // owner not editable here

              return (
                <div
                  key={m.actor_id}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                >
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

                      <div className="mt-1 text-xs text-white/50">
                        Added: {fmtDate(m.created_at)}
                      </div>
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

                      {isBusy && (
                        <span className="self-center text-xs text-white/60">Working…</span>
                      )}
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
                            {(b.display_name ||
                              b.email ||
                              b.phone_digits ||
                              b.actor_id.slice(0, 8)) + ` (${b.role})`}
                          </option>
                        ))}
                      </select>

                      <div className="text-xs text-white/50">
                        This controls where this employee’s WhatsApp logs route for approval.
                      </div>
                    </div>
                  )}

                  {/* Hourly rate row (all non-owner roles) */}
                  {m.role !== "owner" && m.display_name && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="text-xs text-white/60">Hourly rate:</div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-white/60">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          placeholder={rates[m.display_name!] != null ? String((rates[m.display_name!] / 100).toFixed(2)) : "0.00"}
                          value={rateEdits[m.display_name!] ?? (rates[m.display_name!] != null ? String((rates[m.display_name!] / 100).toFixed(2)) : "")}
                          onChange={(e) => setRateEdits((prev) => ({ ...prev, [m.display_name!]: e.target.value }))}
                          onBlur={() => { if (rateEdits[m.display_name!] !== undefined) saveRate(m.display_name!); }}
                          onKeyDown={(e) => { if (e.key === "Enter") saveRate(m.display_name!); }}
                          disabled={rateBusy === m.display_name}
                          className="w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-white/20"
                        />
                        <span className="text-xs text-white/50">/hr</span>
                        {rateBusy === m.display_name && <span className="text-xs text-white/50">Saving…</span>}
                      </div>
                      <div className="text-xs text-white/40">Used to calculate labour cost on time entries.</div>
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