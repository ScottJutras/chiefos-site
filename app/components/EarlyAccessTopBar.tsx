// app/components/EarlyAccessTopBar.tsx
"use client";

import { usePathname } from "next/navigation";

const BAR_TEXT =
  "EARLY ACCESS — New features ship in small batches. Your account stays stable while we scale.";

export default function EarlyAccessTopBar() {
  const pathname = usePathname();

  const show =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/early-access" ||
    pathname === "/finish-signup" ||
    pathname.startsWith("/app");

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-2 text-center text-[11px] tracking-[0.18em] uppercase text-white/85">
        {BAR_TEXT}
      </div>
    </div>
  );
}
