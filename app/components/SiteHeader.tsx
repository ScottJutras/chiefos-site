// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\components\SiteHeader.tsx
"use client";

import Link from "next/link";

type SiteHeaderProps = {
  rightLabel?: string;
  rightHref?: string;
};

export default function SiteHeader({
  rightLabel = "Sign in",
  rightHref = "/login",
}: SiteHeaderProps) {
  return (
    <header
      className="fixed left-0 right-0 z-50"
      style={{ top: "calc(var(--early-access-banner-h) + 8px)" }}
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="mt-3 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C]/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-[#D4A853] text-[#0C0B0A] flex items-center justify-center text-sm font-semibold">
                C
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight text-[#E8E2D8]">
                  ChiefOS
                </div>
                <div className="text-[11px] text-[#A8A090]">
                  Your business, running as a system
                </div>
              </div>
            </Link>

            <Link
              href={rightHref}
              className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-2 text-sm font-medium text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition"
            >
              {rightLabel}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}