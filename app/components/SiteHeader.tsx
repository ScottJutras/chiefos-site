// app/components/SiteHeader.tsx
"use client";

import Link from "next/link";

type SiteHeaderProps = {
  rightLabel?: string;
  rightHref?: string;
};

export default function SiteHeader({
  rightLabel = "Early Access Login",
  rightHref = "/login",
}: SiteHeaderProps) {
  return (
    <header className="fixed top-8 left-0 right-0 z-50">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-black text-white flex items-center justify-center text-sm font-semibold">
                C
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight text-black">ChiefOS</div>
                <div className="text-[11px] text-black/55">Secure portal</div>
              </div>
            </Link>

            <Link
              href={rightHref}
              className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-sm font-medium text-black hover:bg-black/[0.06] transition"
            >
              {rightLabel}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
