import { Suspense } from "react";
import WelcomeClient from "./WelcomeClient";

export const metadata = { title: "Welcome to ChiefOS" };

export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f1117]" />}>
      <WelcomeClient />
    </Suspense>
  );
}
