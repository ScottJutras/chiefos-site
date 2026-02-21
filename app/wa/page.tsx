// app/wa/page.tsx
import { Suspense } from "react";
import WhatsAppGateClient from "./WhatsAppGateClient";

export const metadata = {
  title: "ChiefOS — Start on WhatsApp",
  description: "Quick check to block bots, then we open WhatsApp with ChiefOS.",
};

export default function WhatsAppGatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white/90">Loading…</div>
              <div className="mt-2 text-sm text-white/70">
                Getting the WhatsApp link ready.
              </div>
            </div>
          </div>
        </main>
      }
    >
      <WhatsAppGateClient />
    </Suspense>
  );
}