// app/finish-signup/page.tsx
import { Suspense } from "react";
import FinishSignupClient from "./FinishSignupClient";

export const metadata = {
  title: "ChiefOS — Finishing signup",
  description: "Creating your ChiefOS workspace.",
};

export default function FinishSignupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white text-gray-900">
          <div className="max-w-xl mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Finishing signup…</div>
            </div>
          </div>
        </main>
      }
    >
      <FinishSignupClient />
    </Suspense>
  );
}