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
          className="min-h-screen bg-white text-gray-900"
          style={{ paddingTop: "var(--early-access-banner-h)" }}
        >
          <div className="max-w-md mx-auto px-6 pt-24 pb-20">
            <div className="rounded-2xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-600">Loading…</div>
            </div>
          </div>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
