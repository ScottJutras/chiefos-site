import { Suspense } from "react";
import LinkPhoneClient from "./LinkPhoneClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-xl px-4 py-10 text-sm text-white/70">
            Loading…
          </div>
        </div>
      }
    >
      <LinkPhoneClient />
    </Suspense>
  );
}
