"use client";

import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="w-full border border-white/10 bg-black/70 backdrop-blur-xl rounded-2xl">
      <div className="mx-auto w-full px-4 sm:px-6 h-12 flex items-center justify-between">
        {/* Left: ChiefOS (home) */}
        <Link href="/#top" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-xl bg-white text-black flex items-center justify-center font-bold transition group-hover:-translate-y-[1px]">
            C
          </div>
          <div className="font-semibold tracking-tight text-white">ChiefOS</div>
        </Link>

        {/* Right: Sign in */}
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}