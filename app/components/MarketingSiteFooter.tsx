"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-white/65 hover:text-white/90 transition"
    >
      {children}
    </Link>
  );
}

export default function MarketingSiteFooter() {
  const pathname = usePathname();

  const hide =
    pathname.startsWith("/app") ||
    pathname.startsWith("/api") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/early-access" ||
    pathname.startsWith("/early-access/") ||
    pathname === "/finish-signup" ||
    pathname.startsWith("/finish-signup/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/");

  if (hide) return null;

  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:gap-12">
          <div>
            <div className="text-xl md:text-2xl font-semibold tracking-tight text-white/95">
              Know if you’re making money — instantly.
            </div>
            <p className="mt-3 max-w-2xl text-sm md:text-base leading-relaxed text-white/65">
              Text it → Say it → Snap it → Confirm → Done. Clean records. Clean exports.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Product
              </div>
              <div className="flex flex-col gap-2">
                <FooterLink href="/">Home</FooterLink>
                <FooterLink href="/pricing">Pricing</FooterLink>
                <FooterLink href="/early-access?plan=starter">Tester access</FooterLink>
                <FooterLink href="/login">Log in</FooterLink>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Legal
              </div>
              <div className="flex flex-col gap-2">
                <FooterLink href="/privacy">Privacy</FooterLink>
                <FooterLink href="/terms">Terms</FooterLink>
                <FooterLink href="/legal/ai-policy">AI Policy</FooterLink>
                <FooterLink href="/legal/dpa">DPA</FooterLink>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Contact
              </div>
              <div className="flex flex-col gap-2 text-sm text-white/65">
                <a
                  href="mailto:support@usechiefos.com"
                  className="hover:text-white/90 transition"
                >
                  support@usechiefos.com
                </a>
                <a
                  href="mailto:privacy@usechiefos.com"
                  className="hover:text-white/90 transition"
                >
                  privacy@usechiefos.com
                </a>
                <a
                  href="mailto:legal@usechiefos.com"
                  className="hover:text-white/90 transition"
                >
                  legal@usechiefos.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-xs text-white/40">
          © 2026 ChiefOS. Trust-first operating system for business owners.
        </div>
      </div>
    </footer>
  );
}