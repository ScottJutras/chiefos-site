// app/early-access/page.tsx
// ✅ Server component wrapper to satisfy Next.js Suspense requirement for useSearchParams

import { Suspense } from "react";
import EarlyAccessClient from "./EarlyAccessClient";

export const metadata = {
  title: "ChiefOS — Early Access",
  description:
    "Request early access to ChiefOS. Start with receipts. End with job truth.",
};

export default function EarlyAccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white text-gray-900">
          <div className="max-w-md mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Loading…</div>
            </div>
          </div>
        </main>
      }
    >
      <EarlyAccessClient />
    </Suspense>
  );
}
