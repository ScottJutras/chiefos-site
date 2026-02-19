// app/app/chief/page.tsx
import { Suspense } from "react";
import ChiefClient from "./ChiefClient";

export const metadata = {
  title: "Chief · ChiefOS",
  description: "Ask Chief questions grounded in your logged ledger — with scope and evidence.",
};

export default function ChiefPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="mx-auto max-w-6xl py-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white/90">Loading Chief…</div>
              <div className="mt-2 text-sm text-white/60">Warming up your ledger view.</div>
            </div>
          </div>
        </main>
      }
    >
      <ChiefClient />
    </Suspense>
  );
}
