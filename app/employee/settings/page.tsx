"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.47A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-4.27 5.01" />
      <path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4.12-.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type RuleCheck = { label: string; ok: boolean };

function checkPassword(pw: string): RuleCheck[] {
  return [
    { label: "At least 10 characters", ok: pw.length >= 10 },
    { label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(pw) },
    { label: "One lowercase letter (a–z)", ok: /[a-z]/.test(pw) },
    { label: "One number (0–9)", ok: /[0-9]/.test(pw) },
    { label: "One symbol (!@#$…)", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function SettingsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const firstRun = sp.get("firstRun") === "1";

  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [phoneSaved, setPhoneSaved] = useState<string>("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneOk, setPhoneOk] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>("");
  const [actorId, setActorId] = useState<string>("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const em = String(data?.user?.email || "");
      setEmail(em);

      const w = await fetchWhoami();
      if (!w?.ok || !w.tenantId) return;
      setTenantId(w.tenantId);

      // Load profile to get current phone + actor_id
      if (em) {
        const { data: profiles } = await supabase
          .from("chiefos_tenant_actor_profiles")
          .select("actor_id, phone_digits")
          .eq("tenant_id", w.tenantId)
          .eq("email", em.toLowerCase())
          .limit(1);
        const row = (profiles as any[])?.[0];
        if (row?.actor_id) setActorId(row.actor_id);
        if (row?.phone_digits) {
          setPhone(row.phone_digits);
          setPhoneSaved(row.phone_digits);
        }
      }
    })();
  }, []);

  const rules = useMemo(() => checkPassword(newPassword), [newPassword]);
  const allRulesPass = rules.every((r) => r.ok);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = allRulesPass && passwordsMatch && !busy;

  async function savePassword() {
    setErrMsg(null);
    setOkMsg(null);

    if (!allRulesPass) {
      setErrMsg("Password doesn't meet all requirements.");
      return;
    }
    if (!passwordsMatch) {
      setErrMsg("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setOkMsg("Password saved. Use it to sign in next time.");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (e: any) {
      setErrMsg(String(e?.message || "Could not save password."));
    } finally {
      setBusy(false);
    }
  }

  async function savePhone() {
    setPhoneErr(null);
    setPhoneOk(null);
    const raw = phone.replace(/\D/g, "").trim();
    if (!raw) {
      setPhoneErr("Enter your phone number (digits only).");
      return;
    }
    let digits = raw;
    if (digits.length === 10) digits = "1" + digits;
    if (!(digits.length === 11 && digits.startsWith("1"))) {
      setPhoneErr("Phone must be 10 digits (Canada/US) or include country code (1XXXXXXXXXX).");
      return;
    }

    setPhoneBusy(true);
    try {
      const sess = await supabase.auth.getSession();
      const token = sess?.data?.session?.access_token || "";
      if (!token || !actorId) throw new Error("Missing session.");

      const r = await fetch(`/api/crew/admin/members/${actorId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Could not save phone.");
      setPhone(digits);
      setPhoneSaved(digits);
      setPhoneOk("Phone saved. You can now receive WhatsApp notifications and log via WhatsApp.");
    } catch (e: any) {
      setPhoneErr(String(e?.message || "Could not save phone."));
    } finally {
      setPhoneBusy(false);
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — still want to land on /login
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
        {email && <div className="mt-1 text-sm text-white/55">{email}</div>}
      </div>

      {firstRun && (
        <div className="mb-5 rounded-2xl border border-[#D4A853]/30 bg-[#D4A853]/10 px-4 py-3 text-sm text-[#F4DC9B]">
          Welcome! Set a password below so you can sign in next time
          without needing a new email link every visit. You can skip and
          use email sign-in links instead — your choice.
        </div>
      )}

      {/* Password card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
        <div className="text-sm font-semibold text-white mb-1">
          {firstRun ? "Set a password" : "Change password"}
        </div>

        <div className="grid gap-2.5 mt-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 pr-11 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-white/40 hover:text-[#D4A853] transition"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeIcon off /> : <EyeIcon />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) savePassword();
              }}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 pr-11 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
          </div>
        </div>

        {/* Live rule checklist */}
        <ul className="mt-3 space-y-1">
          {rules.map((r) => (
            <li
              key={r.label}
              className={[
                "flex items-center gap-2 text-xs",
                r.ok ? "text-emerald-400" : "text-white/40",
              ].join(" ")}
            >
              <span className="inline-block w-3 text-center">{r.ok ? "✓" : "·"}</span>
              <span>{r.label}</span>
            </li>
          ))}
          <li
            className={[
              "flex items-center gap-2 text-xs",
              passwordsMatch ? "text-emerald-400" : "text-white/40",
            ].join(" ")}
          >
            <span className="inline-block w-3 text-center">{passwordsMatch ? "✓" : "·"}</span>
            <span>Passwords match</span>
          </li>
        </ul>

        {errMsg && <div className="mt-3 text-xs text-red-300">{errMsg}</div>}
        {okMsg && <div className="mt-3 text-xs text-emerald-300">{okMsg}</div>}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={savePassword}
            disabled={!canSubmit}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              canSubmit
                ? "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]"
                : "bg-[#D4A853]/30 text-white/40 cursor-not-allowed",
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

      {/* Phone number card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
        <div className="text-sm font-semibold text-white mb-1">Phone number</div>
        <div className="text-xs text-white/50 mb-3">
          Link your phone so you can log hours and mileage via WhatsApp and receive notifications.
        </div>

        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 519 965 2188"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
        />

        {phoneErr && <div className="mt-2 text-xs text-red-300">{phoneErr}</div>}
        {phoneOk && <div className="mt-2 text-xs text-emerald-300">{phoneOk}</div>}

        <button
          onClick={savePhone}
          disabled={phoneBusy || phone === phoneSaved}
          className={[
            "mt-3 rounded-xl px-4 py-2 text-sm font-semibold transition",
            phoneBusy || phone === phoneSaved
              ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
              : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
          ].join(" ")}
        >
          {phoneBusy ? "Saving…" : phoneSaved ? "Update phone" : "Save phone"}
        </button>
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
