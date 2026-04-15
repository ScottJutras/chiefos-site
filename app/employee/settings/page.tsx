"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function SettingsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const firstRun = sp.get("firstRun") === "1";

  const [email, setEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(String(data?.user?.email || ""));
    })();
  }, []);

  async function savePassword() {
    setErrMsg(null);
    setOkMsg(null);

    const pw = newPassword.trim();
    if (pw.length < 8) {
      setErrMsg("Password must be at least 8 characters.");
      return;
    }
    if (pw !== confirmPassword.trim()) {
      setErrMsg("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOkMsg("Password saved. You can use it to sign in next time.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setErrMsg(String(e?.message || "Could not save password."));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — we still want to land on /login
    }
    router.replace("/login");
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Settings
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Your account
        </h1>
        {email && (
          <div className="mt-1 text-sm text-white/55">{email}</div>
        )}
      </div>

      {firstRun && (
        <div className="mb-5 rounded-2xl border border-[#D4A853]/30 bg-[#D4A853]/10 px-4 py-3 text-sm text-[#F4DC9B]">
          Welcome! Set a password below so you can sign in next time
          without needing a new email link every visit. You can skip it
          and use email sign-in links instead — your choice.
        </div>
      )}

      {/* Password card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
        <div className="text-sm font-semibold text-white mb-1">
          {firstRun ? "Set a password" : "Change password"}
        </div>
        <div className="text-xs text-white/50 mb-4">
          At least 8 characters.
        </div>

        <div className="grid gap-2.5">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") savePassword(); }}
            placeholder="Confirm password"
            autoComplete="new-password"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
          />
        </div>

        {errMsg && <div className="mt-2 text-xs text-red-300">{errMsg}</div>}
        {okMsg && <div className="mt-2 text-xs text-emerald-300">{okMsg}</div>}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={savePassword}
            disabled={busy || !newPassword.trim()}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              busy || !newPassword.trim()
                ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
                : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
            ].join(" ")}
          >
            {busy ? "Saving…" : firstRun ? "Save password" : "Update password"}
          </button>

          {firstRun && (
            <button
              onClick={() => router.replace("/employee/dashboard")}
              disabled={busy}
              className="text-xs text-white/40 hover:text-white/60 transition"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>

      {/* Account actions */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="text-sm font-semibold text-white mb-3">Session</div>
        <button
          onClick={logout}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-100 hover:bg-red-500/20 hover:text-white transition"
        >
          Log out
        </button>
      </div>

      <div className="mt-6 text-xs text-white/35 text-center">
        Need help? Click the gold "C" on the right side of the screen to
        open ChiefOS Support.
      </div>
    </div>
  );
}

export default function EmployeeSettingsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-white/60">Loading…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
