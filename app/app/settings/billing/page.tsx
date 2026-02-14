import { Suspense } from "react";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-white/70">
            Loading billing…
          </div>
        </div>
      }
    >
      <BillingClient />
    </Suspense>
  );
}
