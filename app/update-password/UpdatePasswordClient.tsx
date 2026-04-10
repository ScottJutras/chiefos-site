"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/app/components/SiteHeader";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function passwordChecks(pw: string) {
  const s = pw || "";
  return {
    len: s.length >= 10,
    upper: /[A-Z]/.test(s),
    lower: /[a-z]/.test(s),
    num: /\d/.test(s),
    sym: /[^A-Za-z0-9]/.test(s),
  };
}

export default function UpdatePasswordClient() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ensure session exists (Supabase sets it when arriving from recovery link)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) {
        setErr("This reset link is invalid or expired. Request a new one.");
      }
    });
  }, []);

  const checks = useMemo(() => passwordChecks(pw), [pw]);
  const pwOk = useMemo(() => Object.values(checks).every(Boolean), [checks]);
  const matchOk = useMemo(() => pw.length > 0 && pw === confirm, [pw, confirm]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!pwOk) throw new Error("Password does not meet the requirements.");
      if (!matchOk) throw new Error("Passwords do not match.");

      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;

      setOk(true);
      setTimeout(() => router.push("/login"), 600);
    } catch (e: any) {
      setErr(e?.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]" style={{ paddingTop: "var(--early-access-banner-h)" }}>
      <SiteHeader rightLabel="Log in" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-[#E8E2D8]">Set a new password</h1>
        <p className="mt-2 text-[#A8A090]">Choose something you’ll remember. You can always reset it again.</p>

        {ok ? (
          <div className="mt-8 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-4">
            <p className="font-medium text-[#E8E2D8]">Password updated</p>
            <p className="mt-2 text-sm text-[#A8A090]">Redirecting to login…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#A8A090]">New password</label>
              <input
                className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#A8A090]">Confirm new password</label>
              <input
                className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="rounded-xl border border-[rgba(212,168,83,0.15)] bg-[rgba(212,168,83,0.05)] p-3 text-xs text-[#A8A090] space-y-1">
              <div className={checks.len ? "text-[#D4A853]" : ""}>• 10+ characters</div>
              <div className={checks.upper ? "text-[#D4A853]" : ""}>• At least one uppercase</div>
              <div className={checks.lower ? "text-[#D4A853]" : ""}>• At least one lowercase</div>
              <div className={checks.num ? "text-[#D4A853]" : ""}>• At least one number</div>
              <div className={checks.sym ? "text-[#D4A853]" : ""}>• At least one symbol</div>
              <div className={matchOk ? "text-[#D4A853]" : ""}>• Passwords match</div>
            </div>

            {err && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>}

            <button
              className="w-full rounded-[2px] bg-[#D4A853] px-4 py-2 text-[#0C0B0A] font-semibold hover:bg-[#C49843] disabled:opacity-60 transition"
              disabled={loading}
              type="submit"
            >
              {loading ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}