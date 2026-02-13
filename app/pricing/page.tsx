// app/pricing/page.tsx
import SiteHeader from "@/app/components/marketing/SiteHeader";
import Section from "@/app/components/marketing/Section";
import SiteFooter from "@/app/components/marketing/SiteFooter";
import WhatsAppIcon from "@/app/components/marketing/WhatsAppIcon";

function Check() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/5">
      <span className="h-2 w-2 rounded-full bg-white/70" />
    </span>
  );
}

function PricingCard({
  name,
  price,
  blurb,
  features,
  ctaLabel,
  ctaHref,
  highlighted,
  badge,
}: {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={[
        "relative rounded-[28px] border p-6 md:p-7",
        highlighted
          ? "border-white/20 bg-white/7 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          : "border-white/10 bg-white/5",
      ].join(" ")}
    >
      {(badge || highlighted) && (
        <div className="absolute -top-3 left-6 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-xs text-white/70 backdrop-blur">
          {badge || "Most popular"}
        </div>
      )}

      <div className="text-sm font-semibold text-white/90">{name}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-4xl font-bold tracking-tight">{price}</div>
        <div className="pb-1 text-sm text-white/60">/ month</div>
      </div>

      <p className="mt-3 text-sm text-white/70 leading-relaxed">{blurb}</p>

      <a
        href={ctaHref}
        className={[
          "mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
          highlighted
            ? "bg-white text-black hover:bg-white/90"
            : "border border-white/15 bg-white/5 text-white hover:bg-white/10",
        ].join(" ")}
      >
        {ctaLabel}
      </a>

      <div className="mt-6 space-y-3">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-3 text-sm text-white/70">
            <Check />
            <div className="leading-relaxed">{f}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold text-white/90">{q}</div>
      <div className="mt-2 text-sm text-white/70 leading-relaxed">{a}</div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      <Section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            Plans reflect operational maturity — not feature upsells.
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Pricing that matches
            <br />
            how contractors work.
          </h1>

          <p className="mt-4 text-lg md:text-xl text-white/70 leading-relaxed">
            Start with capture. Upgrade when you hit a real boundary: speed (OCR/voice), exports, or crew self-logging.
            We don’t break the habit — we add capability.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 overflow-visible">
            <a
              href="/wa?t=pricing"
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "inline-flex items-center justify-center gap-2 rounded-2xl",
                "border border-white/15 bg-white/5 px-5 py-3",
                "text-sm font-semibold text-white hover:bg-white/10 transition",
                "hover:shadow-[0_18px_50px_rgba(37,211,102,0.14)]",
                "hover:-translate-y-[1px] active:translate-y-0",
              ].join(" ")}
            >
              <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
                <WhatsAppIcon className="h-5 w-5 text-white translate-y-[0.5px]" />
              </span>
              Start on WhatsApp
            </a>

            <a
              href="/early-access?plan=starter"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
            >
              Get early access
            </a>
          </div>

          <p className="mt-3 text-xs text-white/45">
            WhatsApp-first. No app download. Owners reason; crews capture (plan-dependent).
          </p>
        </div>
      </Section>

      <Section id="plans" className="pb-10 md:pb-12">
        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            name="Free — Field Capture"
            price="$0"
            blurb="For owners who want a clean slate and a daily capture habit. Start logging immediately."
            ctaLabel="Start free"
            ctaHref="/early-access?plan=free"
            features={[
              "1 Owner",
              "3 Jobs (active or closed)",
              "Expense / revenue / time / tasks (text)",
              "Job totals only (no Ask Chief)",
              "90-day history",
              "No OCR / voice / exports",
            ]}
          />

          <PricingCard
            name="Starter — Owner Mode"
            price="$49"
            blurb="For serious owners who want speed and answers: OCR + voice + Ask Chief (owner-only)."
            ctaLabel="Request Starter access"
            ctaHref="/early-access?plan=starter"
            highlighted
            features={[
              "1 Owner + up to 10 Crew records",
              "25 Jobs",
              "Receipts: OCR + confirm",
              "Voice logging (expenses / revenue / time / tasks)",
              "Ask Chief (Owner only)",
              "Exports enabled (no watermark)",
            ]}
          />

          <PricingCard
            name="Pro — Crew + Control"
            price="$149"
            blurb="For crews with real payroll exposure: self-logging, approvals, audit depth, and board roles."
            ctaLabel="Request Pro access"
            ctaHref="/early-access?plan=pro"
            badge="Crew + Control"
            features={[
              "1 Owner + up to 25 Crew",
              "Up to 10 Board Members (approve/edit; no Ask Chief)",
              "Unlimited Jobs",
              "Crew self-logging from their own phones",
              "Approvals + full audit trail",
              "Priority onboarding (white glove setup)",
            ]}
          />
        </div>
      </Section>

      <Section className="pb-14 md:pb-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-7">
          <div className="text-sm font-semibold text-white/90">What every plan includes</div>
          <div className="mt-2 text-sm text-white/70 leading-relaxed">
            Capture-first workflow, confirm-before-save, and job-anchored truth — so you get understanding, not just totals.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "Never hard-fail: capture continues even when enhancements are gated.",
              "Jobs keep time + expenses + revenue connected to the cause.",
              "Repairable logs: undo, edit flows, and audit trail where needed.",
              "Searchable history so numbers stay traceable.",
            ].map((x) => (
              <div key={x} className="flex items-start gap-3 text-sm text-white/70">
                <Check />
                <div className="leading-relaxed">{x}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="pb-16 md:pb-20">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold text-white/90">Pricing FAQ</div>
          <div className="mt-2 text-sm text-white/70 leading-relaxed">
            The paywall is designed to feel fair: capability upgrades triggered by real usage.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FAQItem
              q="What happens when I hit a plan limit?"
              a="Capture continues. OCR, voice, Ask Chief, and exports pause until you upgrade — and we tell you exactly what happened and why."
            />
            <FAQItem
              q="Can my crew use Ask Chief?"
              a="No. Crew are ‘senses’ — they log reality. Only the Owner uses Ask Chief to reason over company-wide data."
            />
            <FAQItem
              q="What does ‘Approvals + Audit’ mean in Pro?"
              a="Owners (and optional Board Members) approve sensitive edits before they affect job truth. Every change is traceable: who changed what, when, and which job it impacted."
            />
            <FAQItem
              q="What is Priority Onboarding?"
              a="White glove setup: help configuring crew records, job naming conventions, and your first week of capture — so adoption sticks."
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="/early-access?plan=starter"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
            >
              Request Starter access
            </a>
            <a
              href="/early-access?plan=pro"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Request Pro access
            </a>
          </div>

          <p className="mt-3 text-xs text-white/45">
            Early access is limited. We onboard in small batches to keep support tight.
          </p>
        </div>
      </Section>

      <SiteFooter
        brandLine="Start with receipts. End with job truth."
        subLine="Capture real work. Understand real jobs."
      />
    </main>
  );
}
