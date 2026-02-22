// app/app/chief/page.tsx
import React, { Suspense } from "react";
import ChiefClient from "./ChiefClient";

export default function ChiefPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/70">Loading Chief…</div>}>
      <ChiefClient />
    </Suspense>
  );
}