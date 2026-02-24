import { Suspense } from "react";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-white/70">
          Loading billing…
        </div>
      }
    >
      <BillingClient />
    </Suspense>
  );
}