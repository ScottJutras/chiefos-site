// app/app/chief/page.tsx
import { Suspense } from "react";
import ChiefClient from "./ChiefClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ChiefPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/70">Loading Chief…</div>}>
      <ChiefClient />
    </Suspense>
  );
}