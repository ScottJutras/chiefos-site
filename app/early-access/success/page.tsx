// app/early-access/success/page.tsx
import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "ChiefOS — Request received",
  description: "Early access request received. Create your owner account next.",
};

export default function EarlyAccessSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white text-gray-900" style={{ paddingTop: "var(--early-access-banner-h)" }}>
          <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Loading…</div>
            </div>
          </div>
        </main>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}