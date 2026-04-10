// app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata = {
  title: "ChiefOS — Log in",
  description: "Log in to your ChiefOS portal.",
};

export default function LoginPage() {
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
      <LoginClient />
    </Suspense>
  );
}
