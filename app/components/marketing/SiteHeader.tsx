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

const BANNER_H = 32; // px — matches top-8
const HEADER_H = 64; // px — matches h-16

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close mobile menu on Escape
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <>
      {/* Spacer so the fixed banner + header never cover page content */}
      <div style={{ height: BANNER_H + HEADER_H }} aria-hidden="true" />

      {/* Early access banner (fixed) */}
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <div className="h-8 border-b border-white/10 bg-black/90 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-6 h-full flex items-center justify-between">
            <div className="text-[11px] text-white/70">
              <span className="text-white/85 font-semibold">EARLY ACCESS</span>
              <span className="mx-2 text-white/25">—</span>
              New features ship in small batches. Your account stays stable while we scale.
            </div>

            <Link
              href="/early-access?plan=starter"
              className="hidden md:inline-flex text-[11px] font-semibold text-white/80 hover:text-white transition"
            >
              Get access →
            </Link>
          </div>
        </div>
      </div>

      {/* Marketing header (fixed below banner) */}
      <header
        className={[
          "fixed left-0 right-0 z-50",
          "transition-all duration-300",
          scrolled ? "bg-black/70 backdrop-blur-xl border-b border-white/10" : "bg-transparent",
        ].join(" ")}
        style={{ top: BANNER_H }}
      >
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          {/* Logo always goes home */}
          <Link
            href="/#top"
            className="flex items-center gap-2 group"
            onClick={() => setOpen(false)}
          >
            <div className="h-8 w-8 rounded-xl bg-white text-black flex items-center justify-center font-bold transition group-hover:-translate-y-[1px]">
              C
            </div>
            <div className="font-semibold tracking-tight group-hover:text-white transition">
              ChiefOS
            </div>
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
            aria-expanded={open}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>

        {/* Mobile menu (overlay below header) */}
        {open && (
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              style={{ top: BANNER_H + HEADER_H }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-50 border-t border-white/10 bg-black/90 backdrop-blur-xl">
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
          </div>
        )}
      </header>
    </>
  );
}
