// app/components/marketing/SiteHeader.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WhatsAppIcon from "@/app/components/marketing/WhatsAppIcon";
import TooltipChip from "@/app/components/marketing/TooltipChip";

const links = [
  { label: "How it works", href: "/#how" },
  { label: "Scoreboard", href: "/#scoreboard" },
  { label: "Time truth", href: "/#time" },
  { label: "Plans", href: "/#pricing-preview" },
  { label: "FAQ", href: "/#faq" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-8 left-0 right-0 z-50",
        "transition-all duration-300",
        scrolled ? "bg-black/70 backdrop-blur-xl border-b border-white/10" : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        {/* Logo always goes home */}
        <Link href="/#top" className="flex items-center gap-2 group" onClick={() => setOpen(false)}>
          <div className="h-8 w-8 rounded-xl bg-white text-black flex items-center justify-center font-bold transition group-hover:-translate-y-[1px]">
            C
          </div>
          <div className="font-semibold tracking-tight group-hover:text-white transition">ChiefOS</div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-white/70 hover:text-white transition">
            Sign in
          </Link>

          <TooltipChip tip="No app download. Works inside WhatsApp." show={scrolled} className="inline-flex">
            <a
              href="/wa?t=header"
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "inline-flex items-center justify-center gap-2 rounded-2xl",
                "border border-white/15 bg-white/5 px-4 py-2",
                "text-sm font-semibold text-white",
                "hover:bg-white/10 transition",
                "hover:shadow-[0_18px_50px_rgba(37,211,102,0.14)]",
              ].join(" ")}
            >
              <span className="inline-grid h-7 w-7 place-items-center rounded-xl border border-white/10 bg-black/30">
                <WhatsAppIcon className="h-[18px] w-[18px] text-white translate-y-[0.5px]" />
              </span>
              Start on WhatsApp
            </a>
          </TooltipChip>

          <Link
            href="/early-access?plan=starter"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition hover:shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
          >
            Get early access
          </Link>
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-black/90 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-white/80 hover:text-white transition"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}

            <a
              href="/wa?t=mobile"
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "mt-2 inline-flex items-center justify-center gap-2 rounded-2xl",
                "border border-white/15 bg-white/5 px-4 py-3",
                "text-sm font-semibold text-white",
                "hover:bg-white/10 transition",
                "hover:shadow-[0_18px_50px_rgba(37,211,102,0.14)]",
              ].join(" ")}
              onClick={() => setOpen(false)}
            >
              <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
                <WhatsAppIcon className="h-[18px] w-[18px] text-white translate-y-[0.5px]" />
              </span>
              Start on WhatsApp
            </a>

            <div className="pt-2 flex gap-3">
              <Link
                href="/login"
                className="flex-1 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/early-access?plan=starter"
                className="flex-1 inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                onClick={() => setOpen(false)}
              >
                Get early access
              </Link>
            </div>

            <div className="text-xs text-white/45">No app download. Works inside WhatsApp.</div>
          </div>
        </div>
      )}
    </header>
  );
}
