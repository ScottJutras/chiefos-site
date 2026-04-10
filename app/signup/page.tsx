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
        <main
          className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]"
          style={{ paddingTop: "var(--early-access-banner-h)" }}
        >
          <div className="max-w-md mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-4">
              <div className="text-sm text-[#706A60]">Loading…</div>
            </div>
          </div>
        </main>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
