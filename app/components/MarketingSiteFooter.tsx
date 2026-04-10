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
      className="text-sm text-[#A8A090] hover:text-[#D4A853] transition"
    >
      {children}
    </Link>
  );
}

export default function MarketingSiteFooter() {
  const pathname = usePathname();

  const hide =
    pathname === "/" ||
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
    <footer className="border-t border-[rgba(212,168,83,0.15)] bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:gap-12">
          <div>
            <div className="text-xl md:text-2xl font-semibold tracking-tight text-[#E8E2D8]">
              Know if you’re making money — instantly.
            </div>
            <p className="mt-3 max-w-2xl text-sm md:text-base leading-relaxed text-[#A8A090]">
              Text it → Say it → Snap it → Confirm → Done. Clean records. Clean exports.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.18em] text-[#706A60]">
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
              <div className="text-xs uppercase tracking-[0.18em] text-[#706A60]">
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
              <div className="text-xs uppercase tracking-[0.18em] text-[#706A60]">
                Contact
              </div>
              <div className="flex flex-col gap-2 text-sm text-[#A8A090]">
                <a
                  href="mailto:support@usechiefos.com"
                  className="hover:text-[#D4A853] transition"
                >
                  support@usechiefos.com
                </a>
                <a
                  href="mailto:privacy@usechiefos.com"
                  className="hover:text-[#D4A853] transition"
                >
                  privacy@usechiefos.com
                </a>
                <a
                  href="mailto:legal@usechiefos.com"
                  className="hover:text-[#D4A853] transition"
                >
                  legal@usechiefos.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-[rgba(212,168,83,0.1)] pt-5 text-xs text-[#706A60]">
          © 2026 ChiefOS. Trust-first operating system for business owners.
        </div>
      </div>
    </footer>
  );
}