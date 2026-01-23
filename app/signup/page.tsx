"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    try {
      const origin = window.location.origin;

      // Save company name locally so Finish Signup can use it (optional)
      if (companyName.trim()) {
        localStorage.setItem("chiefos_company_name", companyName.trim());
      } else {
        localStorage.removeItem("chiefos_company_name");
      }

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // This is where the confirmation email will send them
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (signUpErr) throw signUpErr;

      // IMPORTANT:
      // Do NOT create tenant here. User is not authenticated until they click the email link.
      setSent(true);
    } catch (e: any) {
      setErr(e?.message ?? "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="mt-2 text-gray-600">Early access portal (owner).</p>

        {sent ? (
          <div className="mt-8 rounded-md border bg-gray-50 p-4">
            <p className="font-medium">Check your email</p>
            <p className="mt-2 text-sm text-gray-600">
              We sent you a confirmation link. Click it to finish creating your account.
            </p>
            <p className="mt-4 text-sm text-gray-600">
              Already confirmed?{" "}
              <a className="underline" href="/login">
                Log in
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium">Company name</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Mission Exteriors (or your company)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Password</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>

            {err && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <button
              className="w-full rounded-md bg-black px-4 py-2 text-white font-medium hover:bg-gray-800 disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Sending link..." : "Sign up"}
            </button>

            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <a className="underline" href="/login">
                Log in
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
