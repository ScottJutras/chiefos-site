// app/components/marketing/SiteFooter.tsx
"use client";

import Link from "next/link";

export default function SiteFooter({
  brandLine = "Start with receipts. End with job truth.",
  subLine = "Capture real work. Understand real jobs.",
}: {
  brandLine?: string;
  subLine?: string;
}) {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="text-lg font-semibold">ChiefOS</div>
            <p className="mt-3 text-sm text-white/60 leading-relaxed">
              {brandLine}
              <br />
              <span className="text-white/50">{subLine}</span>
            </p>

            <div className="mt-6 flex gap-3">
              <Link
                href="/early-access?plan=starter"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Get early access
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
            <div>
              <div className="text-white/80 font-semibold">Explore</div>
              <div className="mt-3 space-y-2 text-white/60">
                <Link className="block hover:text-white transition" href="/#how">
                  How it works
                </Link>
                <Link className="block hover:text-white transition" href="/#scoreboard">
                  Scoreboard
                </Link>
                <Link className="block hover:text-white transition" href="/#time">
                  Time truth
                </Link>
                <Link className="block hover:text-white transition" href="/#pricing-preview">
                  Plans
                </Link>
                <Link className="block hover:text-white transition" href="/#faq">
                  FAQ
                </Link>
              </div>
            </div>

            <div>
              <div className="text-white/80 font-semibold">Legal</div>
              <div className="mt-3 space-y-2 text-white/60">
                <Link className="block hover:text-white transition" href="/privacy">
                  Privacy
                </Link>
                <Link className="block hover:text-white transition" href="/terms">
                  Terms
                </Link>
              </div>
            </div>

            <div>
              <div className="text-white/80 font-semibold">Contact</div>
              <div className="mt-3 space-y-2 text-white/60">
                <Link className="block hover:text-white transition" href="/contact">
                  Contact us
                </Link>
                <div className="text-xs text-white/45">We reply fast. No spam.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-xs text-white/40">
          © {new Date().getFullYear()} ChiefOS. Privacy-first by design.
        </div>
      </div>
    </footer>
  );
}
