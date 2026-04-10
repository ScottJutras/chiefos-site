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
        <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
          <div className="mx-auto max-w-2xl px-6 pt-28 pb-16">
            <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-6">
              <div className="text-sm font-semibold text-[#E8E2D8]">Loading…</div>
              <div className="mt-2 text-sm text-[#A8A090]">
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