// app/early-access/success/page.tsx
import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "ChiefOS — Tester access started",
  description: "Your Starter tester access is ready. Continue into ChiefOS.",
};

export default function EarlyAccessSuccessPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]"
          style={{ paddingTop: "var(--early-access-banner-h)" }}
        >
          <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-4">
              <div className="text-sm text-[#A8A090]">Loading…</div>
            </div>
          </div>
        </main>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}