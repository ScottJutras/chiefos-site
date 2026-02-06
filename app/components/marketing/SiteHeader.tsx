// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\components\marketing\SiteHeader.tsx
"use client";

import { useEffect, useState } from "react";

const links = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Why ChiefOS", href: "#why" },
  { label: "FAQ", href: "#faq" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50",
        "transition",
        scrolled ? "bg-black/70 backdrop-blur border-b border-white/10" : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-white text-black flex items-center justify-center font-bold">
            C
          </div>
          <div className="font-semibold tracking-tight">ChiefOS</div>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-white transition">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="/login"
            className="text-sm text-white/70 hover:text-white transition"
          >
            Sign in
          </a>
          <a
            href="/early-access"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
          >
            Get early access
          </a>
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-black/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-white/80 hover:text-white transition"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="pt-2 flex gap-3">
              <a
                href="/login"
                className="flex-1 inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
                onClick={() => setOpen(false)}
              >
                Sign in
              </a>
              <a
                href="/early-access"
                className="flex-1 inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                onClick={() => setOpen(false)}
              >
                Get early access
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
