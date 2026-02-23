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
    <main className="min-h-screen bg-white text-gray-900" style={{ paddingTop: "var(--early-access-banner-h)" }}>
      <SiteHeader rightLabel="Log in" rightHref="/login" />

      <div className="max-w-md mx-auto px-6 pt-24 pb-20">
        <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-2 text-gray-600">Choose something you’ll remember. You can always reset it again.</p>

        {ok ? (
          <div className="mt-8 rounded-2xl border bg-gray-50 p-4">
            <p className="font-medium">Password updated</p>
            <p className="mt-2 text-sm text-gray-600">Redirecting to login…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium">New password</label>
              <input
                className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Confirm new password</label>
              <input
                className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3 text-xs text-gray-700 space-y-1">
              <div className={checks.len ? "text-emerald-700" : ""}>• 10+ characters</div>
              <div className={checks.upper ? "text-emerald-700" : ""}>• At least one uppercase</div>
              <div className={checks.lower ? "text-emerald-700" : ""}>• At least one lowercase</div>
              <div className={checks.num ? "text-emerald-700" : ""}>• At least one number</div>
              <div className={checks.sym ? "text-emerald-700" : ""}>• At least one symbol</div>
              <div className={matchOk ? "text-emerald-700" : ""}>• Passwords match</div>
            </div>

            {err && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <button
              className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-900 disabled:opacity-60"
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