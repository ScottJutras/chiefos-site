"use client";

import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const justCreated = sp.get("created") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid login credentials")) {
          throw new Error("Email or password is incorrect. Please try again.");
        }
        throw error;
      }

      if (!data?.session) {
        throw new Error("Please confirm your email first, then sign in again.");
      }

      router.push("/supplier/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-white/50">ChiefOS</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Supplier Portal</h1>
          <p className="mt-1 text-sm text-white/50">Sign in to manage your catalog</p>
        </div>

        {justCreated && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Account created! Sign in to continue.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Password</label>
            <input
              type="password" required autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {err && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-white/40">
          Don&apos;t have an account?{" "}
          <Link href="/supplier/signup" className="text-white/70 underline hover:text-white">
            Apply to join
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SupplierLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
