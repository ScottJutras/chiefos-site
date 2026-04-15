"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";

export default function EmployeeRemindersPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    (async () => {
      const w = await fetchWhoami();
      if (!w?.ok) {
        router.replace("/login");
        return;
      }
      const role = String(w.role || "").toLowerCase();
      if (role === "owner" || role === "admin" || role === "board") {
        router.replace("/app/dashboard");
        return;
      }
      const plan = String(w.planKey || "free").toLowerCase();
      if (plan === "free") setLocked(true);
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <div className="text-sm text-white/60">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Reminders
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Your reminders
        </h1>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-sm font-semibold text-white">Available on Starter and Pro</div>
          <div className="mt-1 text-xs text-white/50">
            Your employer is on the Free plan. Reminders are unlocked once
            they upgrade to Starter or Pro.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-sm font-semibold text-white">Set reminders via WhatsApp</div>
          <div className="mt-1 text-xs text-white/50">
            Ask Chief to remind you about anything: &quot;remind me to drop
            off the invoice tomorrow at 8am.&quot; Your reminders will surface
            here once the portal reminder list lands — coming soon.
          </div>
        </div>
      )}
    </div>
  );
}
