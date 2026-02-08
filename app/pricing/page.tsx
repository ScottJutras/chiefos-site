// app/pricing/page.tsx
// ChiefOS Pricing (premium + high conversion)
// Stripe integration later: replace hrefs with your Stripe Checkout links (or /api/stripe/checkout).

import type { ReactNode } from "react";
import SiteHeader from "@/app/components/marketing/SiteHeader";
import Section from "@/app/components/marketing/Section";
import SiteFooter from "@/app/components/marketing/SiteFooter";

type Tier = {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  bestFor: string;
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  bullets: string[];
  includedUsage: string[];
  fineprint?: string;
};

const tiers: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "/ month",
    tagline: "Field Capture",
    bestFor: "Best for: trying ChiefOS and building the habit.",
    ctaLabel: "Start free",
    ctaHref: "/signup",
    bullets: [
      "1 owner",
      "3 jobs total",
      "Text-based logging: expenses, revenue, time, tasks",
      "Basic job totals (no Ask Chief)",
      "Audit-friendly logs",
    ],
    includedUsage: [
      "Expenses: 60 / month",
      "Revenue logs: 30 / month",
      "Time entries: 300 / month",
      "Tasks: 100 / month",
      "History: 90-day rolling window",
    ],
    fineprint:
      "If you hit capacity, you can still log — premium capture features stay paused until the monthly reset or an upgrade.",
  },
  {
    name: "Starter",
    price: "$49",
    cadence: "/ month",
    tagline: "Owner Mode",
    bestFor: "Best for: owners who want clean job truth without admin nights.",
    ctaLabel: "Upgrade to Starter",
    // TODO (Stripe): replace with your Starter checkout link
    ctaHref: "/early-access",
    highlight: true,
    bullets: [
      "Everything in Free",
      "25 jobs",
      "Up to 10 crew members (WhatsApp logging)",
      "Receipt scanning (OCR)",
      "Voice logging",
      "Ask Chief (Owner only)",
      "Exports (no watermark)",
      "3-year retention (while subscribed)",
    ],
    includedUsage: [
      "Receipt scans (OCR): 150 / month",
      "Voice: 150 minutes / month",
      "Ask Chief: 250 questions / month",
      "Higher monthly capture capacity",
    ],
    fineprint:
      "When you hit a monthly capacity, you can keep logging by text. OCR, voice, Ask Chief, and exports pause until reset or upgrade.",
  },
  {
    name: "Pro",
    price: "$149",
    cadence: "/ month",
    tagline: "Crew + Control",
    bestFor: "Best for: crews and serious job profitability control.",
    ctaLabel: "Upgrade to Pro",
    // TODO (Stripe): replace with your Pro checkout link
    ctaHref: "/early-access",
    bullets: [
      "Everything in Starter",
      "Unlimited jobs",
      "Up to 25 crew members",
      "Up to 10 board members (log/edit/approve — no Ask Chief)",
      "Approvals + audit trail",
      "Priority onboarding",
      "7-year retention (while subscribed)",
    ],
    includedUsage: [
      "Receipt scans (OCR): 500 / month",
      "Voice: 500 minutes / month",
      "Ask Chief: 1,000 questions / month",
      "Highest monthly capture capacity",
    ],
    fineprint:
      "Designed for multi-person operations. Maintain job truth with approvals, audit visibility, and long-term history.",
  },
];

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-[28px] border border-white/10 bg-white/5",
        "p-6 md:p-7",
        "shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Check() {
  return (
    <span
      className="mt-[6px] inline-block h-2 w-2 rounded-full bg-white/70"
      aria-hidden="true"
    />
  );
}

export const metadata = {
  title: "ChiefOS Pricing",
  description:
    "Simple pricing built for real contractors. Start free. Upgrade when you want faster capture, deeper answers, and crew control.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      {/* HERO */}
      <Section id="top" className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-white/60" />
            Simple pricing. No tool sprawl.
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            One OS.
            <br />
            One bill.
          </h1>

          <p className="mt-4 text-lg md:text-xl text-white/70 leading-relaxed">
            Most contractors pay for a time clock, a receipt scanner, accounting,
            and “somewhere to track tasks.” ChiefOS replaces the patchwork — and
            keeps every entry attached to the job that caused it.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="/wa?t=pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
            >
              Try on WhatsApp
            </a>
            <a
              href="/early-access"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
            >
              Get early access
            </a>
          </div>

          <p className="mt-3 text-xs text-white/45">
            No app download. Works inside WhatsApp. Built for owners + crews.
          </p>
        </div>
      </Section>

      {/* PLANS */}
      <Section id="plans" className="py-12 md:py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <Card
              key={t.name}
              className={
                t.highlight
                  ? [
                      "relative",
                      "border-white/20",
                      "bg-white/[0.06]",
                      "ring-1 ring-white/15",
                    ].join(" ")
                  : ""
              }
            >
              {t.highlight && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white/70">
                  <span className="h-2 w-2 rounded-full bg-white/60" />
                  Most popular
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-white/60">{t.name}</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight">
                    {t.tagline}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold leading-none">
                    {t.price}
                    <span className="ml-1 text-sm font-semibold text-white/50">
                      {t.cadence}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-white/60">{t.bestFor}</p>

              <div className="mt-6">
                <a
                  href={t.ctaHref}
                  className={[
                    "w-full inline-flex items-center justify-center rounded-2xl px-4 py-3",
                    "text-sm font-semibold transition",
                    t.highlight
                      ? "bg-white text-black hover:bg-white/90 hover:-translate-y-[1px] active:translate-y-0"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:-translate-y-[1px] active:translate-y-0",
                  ].join(" ")}
                >
                  {t.ctaLabel}
                </a>

                {t.fineprint ? (
                  <p className="mt-3 text-xs text-white/45 leading-relaxed">
                    {t.fineprint}
                  </p>
                ) : null}
              </div>

              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="text-xs text-white/50">Includes</div>
                <div className="mt-3 space-y-3">
                  {t.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-3 text-sm">
                      <Check />
                      <div className="text-white/80 leading-relaxed">{b}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="text-xs text-white/50">Included usage</div>
                <div className="mt-3 space-y-2">
                  {t.includedUsage.map((u) => (
                    <div
                      key={u}
                      className="flex items-start gap-3 text-sm text-white/70"
                    >
                      <span className="mt-[6px] h-[3px] w-[10px] rounded-full bg-white/30" />
                      <span>{u}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* WHAT EVERY PLAN INCLUDES (trust + scannability) */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-7">
          <div className="text-sm font-semibold text-white/90">
            What every plan includes
          </div>
          <div className="mt-2 text-sm text-white/70 leading-relaxed">
            Reality-first capture, confirm-before-save, and answers grounded in
            your own records — so you get understanding, not just totals.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "No fabricated answers. Everything stays traceable.",
              "Jobs keep time + expenses + revenue connected.",
              "Fast corrections (undo + repairable logs).",
              "Searchable receipts and activity history.",
            ].map((x) => (
              <div key={x} className="flex items-start gap-3 text-sm text-white/70">
                <Check />
                <div className="leading-relaxed">{x}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* WHAT HAPPENS AT LIMITS (Premium reassurance) */}
      <Section className="py-12 md:py-16">
        <div className="grid gap-6 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What happens when I hit capacity?
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              You can keep logging — ChiefOS never blocks reality. Premium
              capture features pause until your monthly reset or an upgrade.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              {[
                "You can always log by text.",
                "OCR, voice, Ask Chief, and exports pause when you hit their monthly capacity.",
                "Your data stays safe and auditable.",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-white/60" />
                  <div>{x}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-7">
            <Card className="h-full">
              <div className="text-xs text-white/50">Example in-app message</div>
              <div className="mt-2 text-sm font-semibold text-white/90">
                Receipt scanning is paused for this month
              </div>
              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                You can keep logging expenses by text. Upgrade to keep scanning
                receipts instantly.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href="/pricing#plans"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
                >
                  Upgrade
                </a>
                <a
                  href="/wa?t=limits"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
                >
                  Keep logging by text
                </a>
              </div>

              <div className="mt-6 border-t border-white/10 pt-6 text-xs text-white/45">
                Pro tip: you’ll convert more users by keeping logging open and
                only pausing premium capture. That’s exactly how ChiefOS is
                designed.
              </div>
            </Card>
          </div>
        </div>
      </Section>

      {/* PRO FEATURES EXPLAINED */}
      <Section className="py-12 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            What “Approvals + Audit” and “Priority onboarding” mean
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Pro isn’t just “more limits.” It’s control: clean history,
            accountable edits, and faster adoption.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card>
            <div className="text-lg font-semibold">Approvals + audit trail</div>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              Keep job truth clean across a team. Crew can log. Board members can
              review and approve. Every edit is recorded — what changed, when,
              and by who — so your numbers stay defensible.
            </p>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              {[
                "Time approvals (no surprises at payroll)",
                "Edit history for receipts and logs",
                "Role-based control (Owner has Ask Chief)",
                "Dispute-friendly trail (who changed what)",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <Check />
                  <div>{x}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-lg font-semibold">Priority onboarding</div>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              You don’t need “training.” You need a setup that matches how your
              crew actually works. Pro includes a guided rollout so usage sticks.
            </p>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              {[
                "30–45 min owner setup (jobs, categories, roles)",
                "Crew rollout plan (templates + scripts)",
                "Checklist to lock in daily capture habit",
                "Priority support for first month",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <Check />
                  <div>{x}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section className="py-12 md:py-16">
        <Card className="bg-white/[0.06] border-white/15">
          <div className="grid gap-8 md:grid-cols-12 items-center">
            <div className="md:col-span-7">
              <div className="text-2xl md:text-3xl font-bold tracking-tight">
                Capture reality once.
                <br />
                Understand jobs without rebuilding your week at night.
              </div>
              <p className="mt-3 text-white/70 text-sm md:text-base leading-relaxed">
                Start on Free. Upgrade when you want scanning, voice, and Ask
                Chief — without changing how you work.
              </p>
            </div>
            <div className="md:col-span-5 flex flex-col sm:flex-row md:justify-end gap-3">
              <a
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Start free
              </a>
              <a
                href="/wa?t=pricing-cta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Try on WhatsApp
              </a>
            </div>
          </div>
        </Card>
      </Section>

      <SiteFooter
        brandLine="ChiefOS puts reality into the equation."
        subLine="Capture real work. Understand real jobs."
      />
    </main>
  );
}
