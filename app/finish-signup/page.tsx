// app/finish-signup/page.tsx
import { Suspense } from "react";
import FinishSignupClient from "./FinishSignupClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FinishSignupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
          <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-4">
              <div className="text-sm text-[#A8A090]">Finishing signup…</div>
            </div>
          </div>
        </main>
      }
    >
      <FinishSignupClient />
    </Suspense>
  );
}