// app/signup/page.tsx
import { Suspense } from "react";
import SignupClient from "./SignupClient";

export const metadata = {
  title: "ChiefOS — Create account",
  description: "Create your ChiefOS account for early access.",
};

export default function SignupPage() {
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
      <SignupClient />
    </Suspense>
  );
}
