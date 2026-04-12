"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // ✅ use your shared client

function Tile({
  title,
  sub,
  href,
  badge,
}: {
  title: string;
  sub: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition",
        "hover:bg-white/[0.06] hover:-translate-y-[1px] active:translate-y-0",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white/90">{title}</div>
          <div className="mt-2 text-sm text-white/65 leading-relaxed">{sub}</div>
        </div>
        {badge ? (
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
            {badge}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function DangerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        "border border-red-500/25 bg-red-500/10 text-red-100",
        "hover:bg-red-500/15 hover:border-red-500/35",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function NeutralButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!disabled}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        "border border-white/10 bg-white/[0.06] text-white/90",
        "hover:bg-white/[0.09]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

async function postWithBearer(path: string, accessToken: string) {
  const r = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  const ct = r.headers.get("content-type") || "";
  const payload = ct.includes("application/json")
    ? await r.json().catch(() => null)
    : null;

  if (!r.ok) {
    const msg = payload?.message || payload?.error || `Request failed (${r.status})`;
    throw new Error(msg);
  }

  return payload;
}

export default function SettingsPage() {
  const router = useRouter();

  const [busy, setBusy] = useState<null | "logout" | "reset" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmReset, setConfirmReset] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  async function getAccessTokenOrThrow() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("Missing session. Please log in again.");
    return token;
  }

  async function onLogout() {
    setError(null);
    setBusy("logout");
    try {
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Logout failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onResetWorkspace() {
    setError(null);

    if (confirmReset.trim().toUpperCase() !== "RESET") {
      setError('Type "RESET" to confirm.');
      return;
    }

    setBusy("reset");
    try {
      const token = await getAccessTokenOrThrow();
      await postWithBearer("/api/account/reset", token);
      setConfirmReset("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Reset failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteAccount() {
    setError(null);

    if (confirmDelete.trim().toUpperCase() !== "DELETE") {
      setError('Type "DELETE" to confirm.');
      return;
    }

    setBusy("delete");
    try {
      const token = await getAccessTokenOrThrow();
      await postWithBearer("/api/account/delete", token);

      // If core deleted the user, local signOut might fail; ignore.
      await supabase.auth.signOut().catch(() => {});
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-6">
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">Settings</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Workspace Settings
        </h1>
        <div className="mt-3 text-sm text-white/60">
          Preferences, access, billing, and operator reference.
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <NeutralButton onClick={onLogout} disabled={busy !== null}>
            {busy === "logout" ? "Logging out…" : "Log out"}
          </NeutralButton>

          {error ? (
            <div className="text-sm text-red-200/90 border border-red-500/20 bg-red-500/10 px-3 py-2 rounded-xl">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Tile title="Billing" sub="Plan, invoices, and subscription status." href="/app/settings/billing" />
        <Tile
          title="Command Reference"
          sub="Reliable message formats you can copy and send in WhatsApp."
          href="/app/settings/commands"
          badge="Reference"
        />
        <Tile
          title="Email Capture"
          sub="Forward receipts and leads directly to Chief."
          href="/app/settings/email-capture"
          badge="New"
        />
        <Tile
          title="Data Integrity"
          sub="Verify your financial records with cryptographic hash chains."
          href="/app/settings/integrity"
          badge="New"
        />
        <Tile
          title="WhatsApp Connection"
          sub="Manage your WhatsApp linkage and connection health."
          href="/app/connect-whatsapp"
        />
        <Tile
          title="Roles & Permissions"
          sub="Control who can log, approve, and view records."
          href="/app/settings"
          badge="Coming soon"
        />
      </div>

      <div className="rounded-[28px] border border-red-500/20 bg-red-500/[0.06] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-red-100/70">Danger Zone</div>

        <div className="mt-3 text-xl font-semibold text-white/95">Reset or delete</div>

        <div className="mt-2 text-sm text-white/70 leading-relaxed">
          Reset wipes your workspace data (jobs, transactions, receipts, tasks) but keeps your login.
          Delete removes your account completely.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-white/90">Reset workspace data</div>
            <div className="mt-2 text-sm text-white/70">
              Type <span className="font-mono text-white/90">RESET</span> to confirm.
            </div>

            <input
              value={confirmReset}
              onChange={(e) => setConfirmReset(e.target.value)}
              placeholder="Type RESET"
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/90 placeholder:text-white/40 outline-none focus:border-white/20"
            />

            <div className="mt-3">
              <DangerButton onClick={onResetWorkspace} disabled={busy !== null}>
                {busy === "reset" ? "Resetting…" : "Reset my workspace"}
              </DangerButton>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-white/90">Delete account</div>
            <div className="mt-2 text-sm text-white/70">
              Type <span className="font-mono text-white/90">DELETE</span> to confirm.
            </div>

            <input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="Type DELETE"
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/90 placeholder:text-white/40 outline-none focus:border-white/20"
            />

            <div className="mt-3">
              <DangerButton onClick={onDeleteAccount} disabled={busy !== null}>
                {busy === "delete" ? "Deleting…" : "Delete my account"}
              </DangerButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}