// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\pricing\page.tsx
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

      {/* HERO */}
      <Section className="pt-28 md:pt-32 pb-12 md:pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            Stop stacking apps. Start running a system.
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Plans that match
            <br />
            how you actually run work.
          </h1>

          <p className="mt-4 text-lg md:text-xl text-white/70 leading-relaxed">
            Start with capture. Upgrade when you want more speed, more structure, and more control —
            without breaking the habit.
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
              Choose Starter
            </a>
          </div>

          <p className="mt-3 text-xs text-white/45">
            WhatsApp-first. No app download. Capture once → structure automatically → ask anything.
          </p>
        </div>
      </Section>

      {/* PLANS */}
      <Section id="plans" className="pb-10 md:pb-12">
        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            name="Free — Field Capture"
            price="$0"
            blurb="For owners who want a clean slate and a daily capture habit. Start logging immediately."
            ctaLabel="Start free"
            ctaHref="/wa?t=free"
            features={[
              "1 Owner",
              "3 Jobs (active or closed)",
              "Expenses / revenue / time / tasks (text)",
              "Job totals only (no Ask Chief)",
              "90-day history",
              "No OCR / voice / exports",
            ]}
          />

          <PricingCard
            name="Starter — Owner Mode"
            price="$59"
            blurb="For owners who want speed + answers. OCR + voice + Ask Chief (owner-only)."
            ctaLabel="Choose Starter"
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
            blurb="For teams with real payroll exposure: crew self-logging, approvals, audit depth, and board roles."
            ctaLabel="Choose Pro"
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

      {/* INCLUDES */}
      <Section className="pb-14 md:pb-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-7">
          <div className="text-sm font-semibold text-white/90">What every plan includes</div>
          <div className="mt-2 text-sm text-white/70 leading-relaxed">
            A capture-first workflow that turns messy real life into clean records — so your business runs as a system.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "Capture never hard-fails: you can always log the basics.",
              "Jobs keep time + expenses + revenue connected to the cause.",
              "Confirm-before-save so your numbers stay trustworthy.",
              "Searchable history so every number stays traceable.",
            ].map((x) => (
              <div key={x} className="flex items-start gap-3 text-sm text-white/70">
                <Check />
                <div className="leading-relaxed">{x}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* PRICING FAQ */}
      <Section className="pb-16 md:pb-20">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold text-white/90">Pricing FAQ</div>
          <div className="mt-2 text-sm text-white/70 leading-relaxed">
            Plans don’t exist to gate your work — they unlock speed, structure, and control as your operation grows.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <FAQItem
              q="What happens when I hit a plan limit?"
              a="You can still capture. If you hit a limit, the upgrade-only capabilities pause (like OCR, voice, exports, or crew self-logging) — and we tell you exactly what hit the limit."
            />
            <FAQItem
              q="Can my crew use Ask Chief?"
              a="No. Crew are the senses — they capture reality. Owners use Ask Chief to understand the whole operation from the records."
            />
            <FAQItem
              q="What does ‘Approvals + Audit’ mean in Pro?"
              a="Sensitive edits can require approval before they affect job truth. Every change is traceable: who changed what, when, and what job it touched."
            />
            <FAQItem
              q="Is my data trapped?"
              a="No. Paid plans support exports (CSV/XLS/PDF). If you ever leave, your records leave with you."
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="/wa?t=pricing-cta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Start on WhatsApp
            </a>
            <a
              href="/early-access?plan=starter"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
            >
              Choose Starter
            </a>
          </div>

          <p className="mt-3 text-xs text-white/45">
            Stop stacking apps. Start running a system.
          </p>
        </div>
      </Section>

      <SiteFooter
        brandLine="Stop stacking apps. Start running a system."
        subLine="Capture once. Structure automatically. Ask anything."
      />
    </main>
  );
}