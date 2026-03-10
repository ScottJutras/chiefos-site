"use client";

import Link from "next/link";

export default function SiteHeader() {
  const btnBase =
    "inline-flex items-center justify-center h-10 rounded-xl px-4 text-sm font-semibold transition hover:-translate-y-[1px] active:translate-y-0";

  return (
    <header className="w-full border border-white/10 bg-black/70 backdrop-blur-xl rounded-2xl">
      <div className="mx-auto w-full px-4 sm:px-6 h-12 flex items-center justify-between">
        <Link href="/#top" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-xl bg-white text-black flex items-center justify-center font-bold transition group-hover:-translate-y-[1px]">
            C
          </div>
          <div className="font-semibold tracking-tight text-white">ChiefOS</div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/signup"
            className={[btnBase, "bg-white text-black hover:bg-white/90"].join(" ")}
          >
            Start free
          </Link>

          <Link
            href="/login"
            className={[btnBase, "border border-white/15 bg-white/5 text-white hover:bg-white/10"].join(" ")}
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}