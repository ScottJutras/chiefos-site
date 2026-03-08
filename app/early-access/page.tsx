// app/early-access/page.tsx
import { Suspense } from "react";
import EarlyAccessClient from "./EarlyAccessClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "ChiefOS — Start Testing",
  description: "Start testing ChiefOS with Starter tester access. No approval needed.",
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