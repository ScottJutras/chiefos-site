"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWhoami } from "@/lib/whoami";

export default function EmployeePhotosPage() {
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
        router.replace("/app/uploads");
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
          Job-site photos
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Your uploads</h1>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-sm font-semibold text-white">Available on Starter and Pro</div>
          <div className="mt-1 text-xs text-white/50">
            Your employer is on the Free plan. Job-site photo submission is
            unlocked once they upgrade to Starter or Pro.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-sm font-semibold text-white">Send photos via WhatsApp</div>
          <div className="mt-1 text-xs text-white/50">
            Snap a photo and send it to your ChiefOS WhatsApp number. Add a
            note with the job number or name so it gets attached to the
            right job. Web portal upload is coming soon.
          </div>
        </div>
      )}
    </div>
  );
}
