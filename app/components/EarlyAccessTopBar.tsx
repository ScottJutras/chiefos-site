"use client";

import { usePathname } from "next/navigation";

const BAR_TEXT =
  "EARLY ACCESS MEMBER — You’re in. New features ship in batches. Access stays free while we build.";

export default function EarlyAccessTopBar() {
  const pathname = usePathname();

  // Show on “some pages” only:
  // Adjust this list anytime.
  const show =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/app");

  if (!show) return null;

  return (
    <div className="w-full bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-2 text-center text-[11px] tracking-wide">
        {BAR_TEXT}
      </div>
    </div>
  );
}
