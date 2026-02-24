// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\page.tsx
// ChiefOS marketing homepage (Private banking / trading terminal vibe, with sportsbook clarity)
// Drop-in + uses small components under app/components/marketing/*

import SiteHeader from "@/app/components/marketing/SiteHeader";
import Section from "@/app/components/marketing/Section";
import MediaFrame from "@/app/components/marketing/MediaFrame";
import FAQ from "@/app/components/marketing/FAQ";
import SiteFooter from "@/app/components/marketing/SiteFooter";
import WhatsAppIcon from "@/app/components/marketing/WhatsAppIcon";
import TooltipChip from "@/app/components/marketing/TooltipChip";
import StackVsChief from "@/app/components/marketing/StackVsChief";
import { MicroAppsIcon, MobileAppIcon } from "@/app/components/marketing/ToolIcons";
import HeroGetStartedForm from "@/app/components/marketing/HeroGetStartedForm";
import {
  ExpensesIcon,
  TimeIcon,
  RevenueIcon,
  TasksIcon,
  ReminderIcon,
  QuotesIcon,
  DocsIcon,
  JobsIcon,
  ChiefIcon,
} from "@/app/components/marketing/ToolIcons";
export const metadata = {
  title: "ChiefOS",
  description:
    "Stop stacking apps. Start running a system. ChiefOS is a WhatsApp-first business operating system for contractors—capture once, structure automatically, export anytime, and ask your business questions grounded in your records.",
};

function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] tracking-[0.16em] uppercase text-white/55">{label}</div>
        {delta ? (
          <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/65">
            {delta}
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </div>
  );
}

function FeatureRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-sm text-white/70">{k}</div>
      <div className="text-sm font-semibold text-white/85">{v}</div>
    </div>
  );
}

function PlanCard({
  name,
  sub,
  price,
  bullets,
  ctaHref,
  ctaLabel,
  badge,
  foot,
}: {
  name: string;
  sub: string;
  price: string;
  bullets: string[];
  ctaHref: string;
  ctaLabel: string;
  badge?: string;
  foot?: string;
}) {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      {badge ? (
        <div className="absolute right-5 top-5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] text-white/70">
          {badge}
        </div>
      ) : null}

      <div className="text-[12px] tracking-[0.18em] uppercase text-white/55">{name}</div>
      <div className="mt-2 text-xl font-semibold text-white">{sub}</div>

      <div className="mt-5 flex items-end gap-2">
        <div className="text-3xl font-semibold tracking-tight text-white">{price}</div>
        <div className="pb-1 text-sm text-white/55">/ month</div>
      </div>

      <div className="mt-5 space-y-2">
        {bullets.map((b) => (
          <div key={b} className="flex items-start gap-3 text-sm text-white/70">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
            <span>{b}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <a
          href={ctaHref}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
        >
          {ctaLabel}
        </a>
        {foot ? <div className="mt-2 text-xs text-white/45">{foot}</div> : null}
      </div>
    </div>
  );
}

function ToolCard({
  title,
  blurb,
  badge,
  icon,
  featured,
}: {
  title: string;
  blurb: string;
  badge?: string;
  icon: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5 md:p-6 transition",
        featured
          ? [
              "border-white/25",
              "bg-gradient-to-b from-white/[0.10] via-white/[0.05] to-white/[0.03]",
              "shadow-[0_30px_120px_rgba(255,255,255,0.08)]",
              "ring-1 ring-white/10",
              "hover:bg-gradient-to-b hover:from-white/[0.13] hover:via-white/[0.06] hover:to-white/[0.04]",
              "hover:-translate-y-[1px]",
            ].join(" ")
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div className={featured ? "text-center" : "flex items-start justify-between gap-4"}>
        <div className={featured ? "" : "flex items-start gap-3"}>
          <div
  className={[
    "inline-grid place-items-center border",
    featured
      ? "mx-auto mb-5 h-14 w-14 rounded-2xl border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.10)]"
      : "h-10 w-10 rounded-xl border-white/10 bg-black/30",
  ].join(" ")}
>
  {icon}
</div>

          <div>
            {featured ? (
  <>
    <div className="text-2xl md:text-3xl font-semibold text-white leading-tight">
      {title}
    </div>

    <div className="mt-2">
      <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] text-white/70 tracking-wide">
        The CFO Brain
      </span>
    </div>
  </>
) : (
  <div className="flex items-center gap-2">
    <div className="text-base md:text-lg font-semibold text-white/90 leading-tight">
      {title}
    </div>
  </div>
)}

            <div
  className={[
    "mt-2 text-sm text-white/70 leading-relaxed whitespace-pre-line",
    featured ? "mx-auto max-w-[58ch] text-base md:text-lg text-white/75" : "",
  ].join(" ")}
>
  {blurb}
</div>
          </div>
        </div>

        {badge ? (
          <div className="shrink-0 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/65">
            {badge}
          </div>
        ) : null}
      </div>

      {featured ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/70 justify-center">
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            Chief, did I make any money on Job #2?
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            How much did it cost to redo that wall?
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            How much do I need to make so I can pay my bills?
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            Answers grounded truth.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function IconGlyph({ label }: { label: string }) {
  return (
    <span className="text-[11px] tracking-[0.18em] uppercase text-white/80">
      {label}
    </span>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
     <SiteHeader /> 

        
{/* HERO + SYSTEM OVERVIEW */}
<Section id="top" className="pt-8 md:pt-10 pb-16 md:pb-20">
  <div className="max-w-4xl mx-auto text-center">

    {/* HERO HEADLINE */}
    <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
      Integrated tools. One operating system. One price.
    </h1>

    <p className="mt-5 text-lg md:text-xl text-white/75 leading-relaxed">
      The tools you need to manage your business integrated into one operating system.
      Track your buiness conversationally, by text, voice or image without having to spend hours every night doing spreadsheets.
    </p>

    <p className="mt-4 text-base md:text-lg text-white/60 font-medium">
      Stop paying for five apps to run one business.
    </p>

      {/* CTA (Phone input + embedded button → Pricing) */}
      <HeroGetStartedForm pricingHref="/pricing" />
<div className="mt-8 flex flex-col items-center justify-center gap-3">
  <form
    onSubmit={(e) => {
      e.preventDefault();
      const raw = (e.currentTarget as HTMLFormElement).phone?.value || "";
      const phone = String(raw).trim();

      // Route to pricing (optionally pass phone for later prefill)
      const url = phone ? `/pricing?phone=${encodeURIComponent(phone)}` : `/pricing`;
      window.location.href = url;
    }}
    className="w-full max-w-xl"
  >
    <div className="relative">
      <input
        name="phone"
        inputMode="tel"
        autoComplete="tel"
        placeholder="Enter your phone number"
        className={[
          "w-full rounded-2xl border border-white/15 bg-black/30",
          "px-4 py-3 pr-[150px]", // room for the embedded button
          "text-sm text-white placeholder:text-white/40 outline-none",
          "focus:border-white/25 focus:bg-black/35",
        ].join(" ")}
      />

      {/* Embedded button */}
      <button
        type="submit"
        className={[
          "absolute right-1.5 top-1.5",
          "h-[calc(100%-12px)]", // matches input height
          "rounded-xl bg-white px-4",
          "text-sm font-semibold text-black",
          "hover:bg-white/90 transition",
        ].join(" ")}
      >
        Get started
      </button>
    </div>

    {/* Helper line + tooltip */}
    <div className="mt-2 flex items-center justify-center gap-2 text-xs text-white/45">
      <span>No app download. We use your number for WhatsApp access + account linking.</span>

      <TooltipChip tip="We only use your number to open WhatsApp and link your logs to your account. No spam. Never sold.">
        <span className="inline-grid h-5 w-5 place-items-center rounded-md border border-white/10 bg-black/30 text-[11px] text-white/60 cursor-default">
          i
        </span>
      </TooltipChip>
    </div>
  </form>
</div>
</div>

  {/* POWER BLOCK: SENSES → TOOLS */}
<div className="mt-14 max-w-4xl mx-auto">

  {/* Relationship header */}
  <div className="mb-6 flex items-center justify-center gap-4 text-sm text-white/50">
    <span>Conversational Business Management</span>
    <span className="text-white/35">→</span>
    <span>Time and Money saved EVERY . SINGLE . DAY</span>
  </div>

  <div className="grid md:grid-cols-2 gap-6">

    {/* SENSES (LEFT — FIRST TOUCHPOINT) */}
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
      <div className="text-xl md:text-2xl font-semibold text-white">
        Senses
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Text", "Voice", "Receipt Photo (OCR)", "Email Forward"].map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-white/85"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-5 text-sm text-white/60 leading-relaxed">
        Log anything using the fastest input in the moment — no switching apps.
      </div>

      <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
        More inputs coming
      </div>
    </div>

    {/* TOOLS (RIGHT — STRUCTURED OUTPUT) */}
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
      <div className="text-xl md:text-2xl font-semibold text-white">
        Tools
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Expenses", "Time Clock", "Tasks", "Jobs"].map((t) => (
          <span
            key={t}
            className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-white/85"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-5 text-sm text-white/60 leading-relaxed">
        Every entry becomes structured, tied to jobs, and connected across the system.
      </div>

      <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
        More tools coming
      </div>
    </div>

  </div>

  {/* System explanation footer */}
  <div className="mt-6 text-center text-xs text-white/45">
    No more stacking expensive apps just to make it through the day.
  </div>

</div>
  {/* CURRENT FEATURES GRID */}
  <div className="mt-16 grid gap-6 md:grid-cols-2">

    <ToolCard
      title="Expenses"
      icon={<ExpensesIcon className="h-6 w-6 text-white/80" />}
      blurb="Capture expenses by text, voice, photo, or email. Auto-structured, attached to jobs, and export-ready without nightly cleanup."
    />

    <ToolCard
      title="Time Clock"
      icon={<TimeIcon className="h-6 w-6 text-white/80" />}
      blurb="Clock in, out, break, and drive from WhatsApp. Categorized, traceable, and tied directly to jobs and costs."
    />

    <ToolCard
      title="Tasks"
      icon={<TasksIcon className="h-6 w-6 text-white/80" />}
      blurb="Create, assign, and track tasks linked to time and money. Keep work accountable without separate task apps."
    />

    <ToolCard
      title="Jobs"
      icon={<JobsIcon className="h-6 w-6 text-white/80" />}
      blurb="Every expense, shift, and task connects to a job. See totals, margins, and activity in one structured timeline."
    />

    {/* CHIEF — FULL WIDTH */}
    <div className="md:col-span-2">
      <ToolCard
        title="Chief"
        featured
        icon={<ChiefIcon className="h-8 w-8 text-white" />}
        blurb="Chief sits under every tool, linking jobs, time, and money into one record. It answers only from what’s been logged, flags what’s missing, and never guesses."
      />
    </div>
  </div>

  {/* COMING SOON */}
  <div className="mt-20">
    <div className="text-xs tracking-[0.18em] uppercase text-white/50 text-center">
      Coming Soon
    </div>

    <div className="mt-6 grid gap-6 md:grid-cols-2">

      <ToolCard
        title="Documents"
        badge="Coming soon"
        icon={<DocsIcon className="h-6 w-6 text-white/80" />}
        blurb="Generate quotes, contracts, change orders, invoices, and receipts from conversation, text, or images."
      />

      <ToolCard
        title="Reminders"
        badge="Coming soon"
        icon={<ReminderIcon className="h-6 w-6 text-white/80" />}
        blurb="Set smart reminders connected to tasks, jobs, and payments so nothing falls through the cracks."
      />

      <ToolCard
        title="Email Receipt Capture"
        badge="Coming soon"
        icon={<ExpensesIcon className="h-6 w-6 text-white/80" />}
        blurb="Forward receipt emails directly to your account. Automatically parsed and attached to the right job."
      />

      <ToolCard
        title="Pictures"
        badge="Coming soon"
        icon={<DocsIcon className="h-6 w-6 text-white/80" />}
        blurb="Store and organize job site photos and business images, searchable and connected to projects."
      />

      <ToolCard
       title="Micro Apps"
       badge="Coming soon"
       icon={<MicroAppsIcon className="h-6 w-6 text-white/80" />}
       blurb="Instant, single-purpose tools you can open and use right away — no app store, no downloads. Quick workflows that still write into the same system."
      />

      <ToolCard
      title="Mobile App"
      badge="Coming soon"
      icon={<MobileAppIcon className="h-6 w-6 text-white/80" />}
      blurb="Optional mobile capture for teams that want it. Not required to use ChiefOS — just another way to send time, receipts, and job updates into the same system."
      />

      </div>
      </div>
     </Section>

     {/* NOTHING TRAPPED */}
<Section id="exports" className="py-14 md:py-20">
  <div className="grid md:grid-cols-12 gap-10 items-start">
    {/* LEFT COPY */}
    <div className="md:col-span-5">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
        Your data is yours.
        <br />
        Export anytime.
      </h2>

      <p className="mt-4 text-white/70 text-lg leading-relaxed">
        Clean records in.
        <br />
        Clean exports out.
      </p>

      <p className="mt-4 text-white/70 text-lg leading-relaxed">
        Accountants love clean spreadsheets — and so does Chief.
      </p>

      <div className="mt-6 text-lg font-semibold text-white/90">
        Nothing trapped.
      </div>
    </div>

    {/* RIGHT: EXPORTABLE ASSETS (NO MEDIAFRAME) */}
    <div className="md:col-span-7">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
            Exportable assets
          </div>
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
            Download anytime
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {/* Spreadsheets */}
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white/85">Spreadsheets</div>
                <div className="mt-1 text-xs text-white/55">
                  Expenses, time, jobs, tasks — export clean totals and line items.
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {["CSV", "XLS", "PDF"].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/70"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Receipt Images */}
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white/85">Receipt images</div>
                <div className="mt-1 text-xs text-white/55">
                  Download original receipt attachments — linked to the exact entry.
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {["JPG", "PNG", "ZIP"].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/70"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Voice Recordings */}
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white/85">Voice recordings</div>
                <div className="mt-1 text-xs text-white/55">
                  Download audio files (and the structured entry they produced).
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {["MP3", "M4A", "ZIP"].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/70"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/45">
          One system in. Clean exports out — ready for accountants, payroll, or your own backups.
        </div>
      </div>
    </div>
  </div>
</Section>

   {/* STACK → SYSTEM (CENTERED COMPARISON) */}
<Section id="stack-system" className="py-14 md:py-20">
  <div className="max-w-5xl mx-auto text-center">
    <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
      One price beats a stack of bills.
    </h2>

    <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
      Most owners patch together time tracking, receipts, CRM, accounting, and spreadsheets.
      ChiefOS replaces the stack with one connected system.
    </p>

    {/* BIG COMPARISON MODULE */}
    <div className="mt-10">
      <StackVsChief variant="wide" />
    </div>

    <div className="mt-6 text-xs text-white/45 max-w-3xl mx-auto">
      Typical pricing varies by vendor and plan. This comparison is a conservative snapshot to show the cost of fragmentation
      (exports, re-entry, and rebuilding jobs by hand).
    </div>
  </div>
</Section>

{/* PLANS (Framed around maturity + aligned with new language) */}
<Section id="pricing-preview" className="py-14 md:py-20">
  <div className="max-w-3xl">
    <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
      Start simple. Grow into structure.
    </h2>
    <p className="mt-4 text-white/70 text-lg leading-relaxed">
      Free gets you capturing. Starter adds speed + answers. Pro adds crew controls — without losing the habit.
    </p>
  </div>

  <div className="mt-10 grid gap-6 md:grid-cols-3">
    <PlanCard
      name="Free"
      sub="Field Capture"
      price="$0"
      badge="Start here"
      bullets={[
        "WhatsApp capture (text)",
        "3 jobs • 90-day history",
        "Job totals (no Ask Chief)",
        "No receipt photos, no voice, no exports",
      ]}
      ctaHref="/wa?t=free"
      ctaLabel="Start on WhatsApp"
      foot="Free is for capture. Paid is for speed, answers, and control."
    />

    <PlanCard
      name="Starter"
      sub="Owner Mode"
      price="$59"
      badge="Most popular"
      bullets={[
        "Receipt photos + voice logging",
        "Ask Chief (owner-only)",
        "25 jobs • 1-year history",
        "Exports included (CSV/XLS/PDF)",
      ]}
      ctaHref="/early-access?plan=starter"
      ctaLabel="Get it now"
      foot="For owners who want clarity without the night shift."
    />

    <PlanCard
      name="Pro"
      sub="Crew + Control"
      price="$149"
      badge="Teams"
      bullets={[
        "Crew self-logging from their own phones",
        "Approvals + audit trail",
        "Unlimited jobs • 7-year history",
        "Board seats (bookkeepers/advisors)",
      ]}
      ctaHref="/early-access?plan=pro"
      ctaLabel="Get it now"
      foot="Crew captures. Owner approves. Chief keeps it grounded."
    />
  </div>

  <div className="mt-6 text-xs text-white/45">
    Upgrade when you hit a boundary. Paid plans stay reversible with exports — nothing trapped.
  </div>
</Section>


      {/* STOP THE NIGHT SHIFT */}
      <Section id="night-shift" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Get your evenings back.
            </h2>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Most owners spend 30 minutes to 1.5 hours per day:
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              {[
                "Cleaning receipts",
                "Updating spreadsheets",
                "Reconciling entries",
                "Moving data between apps",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                  <div>{x}</div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-white/70 text-lg leading-relaxed">
              And at the end of it?
              <br />
              The data just sits there.
            </p>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              You can’t talk to it.
              <br />
              You can’t ask it questions.
              <br />
              You just store it.
            </p>

            <p className="mt-6 text-white/70 text-lg leading-relaxed">
              ChiefOS captures it while you work — and makes it usable immediately.
            </p>

            <div className="mt-6 text-lg font-semibold text-white/90">
              Text it. <span className="text-white/60">Say it.</span> <span className="text-white/60">Snap it.</span>
            </div>

            <div className="mt-2 text-sm text-white/70">Confirm. Done.</div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Capture flow" title="Capture → confirm → stored clean">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Example</div>

                <div className="mt-4 space-y-3">
                  {[
                    { t: "Text", d: "Expense $35.50 at Staples • Job 12", s: "Confirm" },
                    { t: "Voice", d: "“$120 in materials for Hampton job”", s: "Parsed" },
                    { t: "Photo", d: "Receipt image • Auto-filled fields", s: "Ready" },
                    { t: "Stored", d: "Job timeline + export-ready records", s: "Done" },
                  ].map((row) => (
                    <div
                      key={row.t}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white/85">{row.t}</div>
                        <div className="text-xs text-white/55">{row.d}</div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
                        {row.s}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs text-white/45">
                  Capture once. No nightly cleanup loop.
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

 {/* TALK TO YOUR BUSINESS */}
<Section id="ask" className="py-14 md:py-24">
  <div className="grid md:grid-cols-12 gap-10 items-start">
    <div className="md:col-span-5">
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        Talk to your business.
      </h2>

      <p className="mt-4 text-white/70 text-lg leading-relaxed">
        Most spreadsheets just sit there.
      </p>
      <p className="mt-2 text-white/70 text-lg leading-relaxed">
        ChiefOS answers back — using your logged records.
      </p>

      <div className="mt-6 space-y-3 text-sm text-white/70">
        {[
          "“Did we make money on the Hampton job?”",
          "“What did it cost per hour last week?”",
          "“Where are we overspending?”",
          "“Did we actually make money last month?”",
        ].map((x) => (
          <div key={x} className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
            <div>{x}</div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-white/70 text-lg leading-relaxed">
        Answers come from what you’ve logged and confirmed.
        <br />
        <span className="text-white/85 font-semibold">No guessing. No invented numbers.</span>
      </p>

      <div className="mt-6 text-sm text-white/55">
        If something is missing, Chief flags it instead of making it up.
      </div>
    </div>

    <div className="md:col-span-7">
      <MediaFrame
        label="Ask Chief"
        title="Ask a real question. Get a grounded answer."
        subtitle="Examples shown for illustration"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
              Conversation (example)
            </div>
            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
              Based on logged entries
            </div>
          </div>

          {/* Quick prompts */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Profit on Hampton?",
              "Top overspending?",
              "Cost per hour last week?",
              "Did we make money last month?",
            ].map((q) => (
              <span
                key={q}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70"
              >
                {q}
              </span>
            ))}
          </div>

          {/* Chat bubbles */}
          <div className="mt-5 space-y-3">
            {/* Q1 */}
            <div className="flex justify-end">
              <div className="max-w-[92%] rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <div className="text-xs text-white/50 tracking-[0.16em] uppercase">You</div>
                <div className="mt-1 text-sm text-white/80">
                  Did we make money on the Hampton job?
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="text-xs text-white/50 tracking-[0.16em] uppercase">Chief</div>
                <div className="mt-1 text-sm text-white/80 leading-relaxed">
                  Hampton shows <span className="text-white/90 font-semibold">$4,820 revenue</span> and{" "}
                  <span className="text-white/90 font-semibold">$3,110 costs</span> from confirmed entries →{" "}
                  <span className="text-white/90 font-semibold">$1,710 profit</span>.
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {["Revenue entries: 3", "Cost entries: 12", "Time: 44.0h"].map((x) => (
                    <span
                      key={x}
                      className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/65"
                    >
                      {x}
                    </span>
                  ))}
                </div>

                <div className="mt-3 text-xs text-white/55">
                  If payroll or materials are missing, Chief flags it.
                </div>
              </div>
            </div>

            {/* Q2 */}
            <div className="flex justify-end">
              <div className="max-w-[92%] rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <div className="text-xs text-white/50 tracking-[0.16em] uppercase">You</div>
                <div className="mt-1 text-sm text-white/80">
                  Where are we overspending?
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="text-xs text-white/50 tracking-[0.16em] uppercase">Chief</div>
                <div className="mt-1 text-sm text-white/80 leading-relaxed">
                  Top cost drivers this month are{" "}
                  <span className="text-white/90 font-semibold">Materials</span> and{" "}
                  <span className="text-white/90 font-semibold">Fuel</span>. Biggest vendor is{" "}
                  <span className="text-white/90 font-semibold">Home Depot</span> based on logged receipts.
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { k: "Materials", v: "$3,940" },
                    { k: "Fuel", v: "$1,180" },
                    { k: "Tools", v: "$620" },
                    { k: "Meals", v: "$210" },
                  ].map((r) => (
                    <div
                      key={r.k}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="text-xs text-white/55">{r.k}</div>
                      <div className="text-sm font-semibold text-white/85">{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Q3 */}
            <div className="flex justify-end">
              <div className="max-w-[92%] rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <div className="text-xs text-white/50 tracking-[0.16em] uppercase">You</div>
                <div className="mt-1 text-sm text-white/80">
                  Did we make money last month?
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="text-xs text-white/50 tracking-[0.16em] uppercase">Chief</div>
                <div className="mt-1 text-sm text-white/80 leading-relaxed">
                  Last month totals from confirmed entries:{" "}
                  <span className="text-white/90 font-semibold">$18,400 revenue</span>,{" "}
                  <span className="text-white/90 font-semibold">$12,950 costs</span> →{" "}
                  <span className="text-white/90 font-semibold">$5,450 profit</span>. Want this broken down by job?
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {["Jobs included: 7", "Revenue entries: 19", "Cost entries: 62"].map((x) => (
                    <span
                      key={x}
                      className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/65"
                    >
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-white/45">
            Example UI. Real answers come from your logged and confirmed records.
          </div>
        </div>
      </MediaFrame>
    </div>
  </div>
</Section>

      {/* VALUE CARDS (Outcome-forward) */}
<Section id="value" className="py-14 md:py-24">
  <div className="max-w-3xl">
    <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
      When your tools are integrated,
      <br />
      you make more money. period.
    </h2>

    <p className="mt-4 text-white/70 text-lg leading-relaxed max-w-2xl">
      Not more features. Fewer gaps. Less cleanup. Clearer decisions.
    </p>
  </div>

  <div className="mt-12 grid gap-6 md:grid-cols-5">
    {[
      {
        h: "Time, Connected",
        p: "Log hours by text, voice, or photo — automatically tied to jobs and costs. No floating time. No reconciliation later.",
      },
      {
        h: "Money, Structured",
        p: "Capture expenses and revenue instantly. Eliminate nightly cleanup. Save 30–90 minutes a day.",
      },
      {
        h: "Tasks, Accountable",
        p: "Assign and track tasks linked to time and money. Approvals, permissions, audit trails built in.",
      },
      {
        h: "Records, Clean",
        p: "Export pristine data anytime — CSV, XLS, PDF. Nothing trapped. Nothing rebuilt.",
      },
      {
        h: "Answers, On Demand",
        p: "Ask real questions about jobs, margins, and costs. Get grounded answers from your records.",
      },
    ].map((x) => (
      <div
        key={x.h}
        className="group relative rounded-2xl border border-white/10 bg-white/[0.05] p-6 transition hover:-translate-y-[3px] hover:border-white/20 hover:bg-white/[0.08]"
      >
        {/* subtle glow */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />

        <div className="relative">
          <div className="text-base md:text-lg font-semibold text-white leading-tight">
            {x.h}
          </div>

          <p className="mt-3 text-sm md:text-[15px] text-white/70 leading-relaxed">
            {x.p}
          </p>
        </div>
      </div>
    ))}
  </div>
</Section>

      {/* JOB PERFORMANCE (no sports language) */}
<Section id="scoreboard" className="py-14 md:py-24">
  <div className="grid md:grid-cols-12 gap-10 items-start">
    {/* LEFT */}
    <div className="md:col-span-5">
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        Know what each job is really doing.
      </h2>

      <p className="mt-4 text-white/70 text-lg leading-relaxed">
        ChiefOS shows performance job by job — with totals you can trace back to what was logged.
      </p>

      <div className="mt-8 space-y-4">
        {[
          {
            h: "Clear job margin",
            p: "Revenue − (labour + expenses). No mystery math — just your records.",
          },
          {
            h: "Payroll-grade time clarity",
            p: "Breaks and drive are tracked distinctly, with overlap prevention and approvals.",
          },
          {
            h: "Answers with receipts",
            p: "Every number ties back to entries: who logged it, when, and what job it belongs to.",
          },
        ].map((x) => (
          <div
            key={x.h}
            className="group relative rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:-translate-y-[2px] hover:border-white/20 hover:bg-white/[0.08]"
          >
            {/* subtle glow */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
            <div className="relative">
              <div className="text-base font-semibold text-white/90">{x.h}</div>
              <div className="mt-2 text-sm text-white/70 leading-relaxed">{x.p}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-white/70 text-lg leading-relaxed">
        Ask a question — Chief answers from what’s logged and confirmed.
        <br />
        <span className="text-white/85 font-semibold">No invented numbers.</span>
      </p>
    </div>

    {/* RIGHT */}
    <div className="md:col-span-7">
      <MediaFrame label="Business terminal" title="Job performance overview (example)">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Overview</div>
            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
              Month-to-date
            </div>
          </div>

          {/* Example questions (chips) */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Did Job 18 make money?",
              "What’s our cost per hour this week?",
              "Where are we overspending?",
              "What job is at risk?",
            ].map((q) => (
              <span
                key={q}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70"
              >
                {q}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Cash In" value="$148,240" delta="+8.4%" hint="Month-to-date" />
            <StatCard label="Cash Out" value="$103,910" delta="+4.1%" hint="Month-to-date" />
            <StatCard label="Net" value="$44,330" delta="+15.7%" hint="In – Out" />
            <StatCard label="Open Invoices" value="$26,400" hint="Outstanding" />
            <StatCard label="Unbilled Labour" value="38.5h" hint="This week" />
            <StatCard label="Labour Today" value="7.0h" hint="Active shifts" />
          </div>

          {/* Job list */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                Jobs
              </div>
              <div className="text-[11px] text-white/50">Filter • Sort • Drill in</div>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { job: "Job 18 — Medway Dr", rev: "$12,400", cost: "$9,980", lab: "44.0h", margin: "+19.5%", status: "On track" },
                { job: "Job 12 — Pine Ave", rev: "$7,850", cost: "$6,910", lab: "31.5h", margin: "+12.0%", status: "On track" },
                { job: "Job 09 — King St", rev: "$5,100", cost: "$5,620", lab: "22.0h", margin: "-10.2%", status: "At risk" },
              ].map((r) => (
                <div
                  key={r.job}
                  className="group rounded-xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-white/20 hover:bg-black/35"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white/85">{r.job}</div>
                      <div className="text-xs text-white/55">
                        Rev {r.rev} • Cost {r.cost} • Labour {r.lab}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Margin</div>
                      <div className="text-sm font-semibold text-white/85">{r.margin}</div>
                    </div>
                  </div>

                  {/* grounded proof line */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["View entries", "Receipts attached", "Time approved"].map((x) => (
                      <span
                        key={x}
                        className="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] text-white/60"
                      >
                        {x}
                      </span>
                    ))}

                    <span className="ml-auto rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] text-white/60">
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-white/45">
              Example UI. Your totals come from what you log and confirm.
            </div>
          </div>

          {/* Tiny example Q/A preview */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Example answer</div>
            <div className="mt-2 text-sm text-white/75 leading-relaxed">
              <span className="text-white/85 font-semibold">Job 18 margin is +19.5% </span>
              based on logged revenue ($12,400) and logged costs ($9,980). If payroll or materials are missing, Chief flags it.
            </div>
          </div>
        </div>
      </MediaFrame>
    </div>
  </div>
</Section>

        

 {/* TIMESHEET CLARITY */}
<Section id="time" className="py-14 md:py-24">
  <div className="grid md:grid-cols-12 gap-10 items-start">
    <div className="md:col-span-5">
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        Not a timer.
        <br />
        Payroll-grade shift clarity.
      </h2>

      <p className="mt-4 text-white/70 text-lg leading-relaxed">
        Shift time isn’t one number. ChiefOS tracks the categories that actually matter — legally,
        financially, and for job costing.
      </p>

      {/* Pop cards instead of plain rows */}
      <div className="mt-8 space-y-4">
        {[
          { k: "Shift time", v: "Recorded", d: "Clock in → clock out (raw timeline)" },
          { k: "Break time", v: "Recorded (separate)", d: "Not mixed into work time" },
          { k: "Lunch time", v: "Recorded (separate)", d: "Tracked distinctly for payroll rules" },
          { k: "Drive time", v: "Tracked (not deducted)", d: "Visible for costing and billing" },
          { k: "Work time", v: "Calculated", d: "Shift − breaks − lunch" },
          { k: "Paid time", v: "Calculated", d: "Work + paid drive (your rules)" },
        ].map((x) => (
          <div
            key={x.k}
            className="group relative rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:-translate-y-[2px] hover:border-white/20 hover:bg-white/[0.08]"
          >
            {/* subtle glow */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-white/90">{x.k}</div>
                <div className="mt-1 text-sm text-white/65">{x.d}</div>
              </div>

              <div className="shrink-0 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
                {x.v}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-sm text-white/55 leading-relaxed">
        Built for repairs: confirmations, undo actions, approvals, and an audit trail — so corrections don’t destroy trust.
      </div>
    </div>

    <div className="md:col-span-7">
      <MediaFrame label="Time categories" title="A shift that stays traceable" subtitle="Shift • Break • Lunch • Drive • Work • Paid">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Example shift</div>
            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
              Job 18 • Medway Dr
            </div>
          </div>

          {/* Example actions (chips) */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Mike clocked in",
              "Break started",
              "Break ended",
              "Lunch started",
              "Lunch ended",
              "Drive started",
              "Drive ended",
              "Clocked out",
            ].map((x) => (
              <span
                key={x}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70"
              >
                {x}
              </span>
            ))}
          </div>

          {/* Timeline summary */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Timeline</div>

            <div className="mt-3 grid gap-2">
              {[
                { t: "07:12", d: "Clock in", tag: "Shift" },
                { t: "10:05", d: "Break", tag: "Break" },
                { t: "12:02", d: "Lunch", tag: "Lunch" },
                { t: "14:18", d: "Drive", tag: "Drive" },
                { t: "16:41", d: "Clock out", tag: "Shift" },
              ].map((row) => (
                <div
                  key={row.t + row.d}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-white/60 w-[44px]">{row.t}</div>
                    <div>
                      <div className="text-sm font-semibold text-white/85">{row.d}</div>
                      <div className="text-xs text-white/55">Job 18 • Medway Dr</div>
                    </div>
                  </div>

                  <div className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] text-white/60">
                    {row.tag}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-white/45">
              Every event is logged. Nothing collapses into a single guessed number.
            </div>
          </div>

          {/* Category totals */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Shift" value="9.5h" hint="Clock in → out" />
            <StatCard label="Break" value="0.3h" hint="Separate" />
            <StatCard label="Lunch" value="0.5h" hint="Separate" />
            <StatCard label="Drive" value="0.8h" hint="Tracked" />
            <StatCard label="Work" value="8.7h" hint="Calculated" />
            <StatCard label="Paid" value="9.5h" hint="Rules-based" />
          </div>

          {/* Example Q/A */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Example question</div>
            <div className="mt-2 text-sm text-white/75 leading-relaxed">
              <span className="text-white/85 font-semibold">Q:</span> “How many paid hours did Mike work on Job 18 today?”
              <br />
              <span className="text-white/85 font-semibold">A:</span> “Mike has <span className="text-white/90 font-semibold">9.5 paid hours</span> on Job 18 today.
              Work time is 8.7h (shift − breaks − lunch) plus 0.8h drive tracked separately.”
            </div>
          </div>
        </div>
      </MediaFrame>
    </div>
  </div>
</Section>

   

 {/* FINAL CLOSE (Proof + CTA merged) */}
<Section id="close" className="py-14 md:py-24">
  <div className="max-w-5xl mx-auto">
    {/* Headline */}
    <div className="text-center">
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        Run your business on one system.
        <br />
        Not a stack of apps.
      </h2>

      <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
        Capture time, money, and job activity where work happens — then ask Chief what it means.
        Clear answers, grounded in what you’ve logged.
      </p>

      {/* CTAs */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center overflow-visible">
        <TooltipChip tip="Fastest path: start on WhatsApp in minutes.">
          <a
            href="/wa?t=cta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
          >
            <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
              <WhatsAppIcon className="h-5 w-5 text-white translate-y-[0.5px]" />
            </span>
            Start on WhatsApp
          </a>
        </TooltipChip>

        <a
          href="/early-access?plan=starter"
          className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
        >
          Get it now
        </a>
      </div>

      <div className="mt-3 text-xs text-white/45">
        One price per tier. Export anytime. Nothing trapped.
      </div>
    </div>

    {/* Proof + “what it looks like” */}
    <div className="mt-12 grid md:grid-cols-12 gap-6 items-start">
      {/* Proof cards */}
      <div className="md:col-span-5">
        <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
          What owners feel
        </div>

        <div className="mt-4 space-y-4">
          {[
            {
              q: "“I finally know what’s going on.”",
              s: "Jobs stopped being a mystery.",
            },
            {
              q: "“Everything connects now.”",
              s: "Time, money, and tasks stopped living in different places.",
            },
            {
              q: "“I’m not rebuilding at night anymore.”",
              s: "Capture during the day. Clarity right after.",
            },
            {
              q: "“When someone asks if we made money, I can answer.”",
              s: "Not a feeling. The record is right there.",
            },
          ].map((t) => (
            <div
              key={t.q}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:-translate-y-[2px] hover:border-white/20 hover:bg-white/[0.08]"
            >
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="text-base md:text-lg text-white/90 leading-relaxed">
                  {t.q}
                </div>
                <div className="mt-2 text-sm text-white/55">{t.s}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-white/45">
          Examples of outcomes ChiefOS is built to create: clarity → control → confidence.
        </div>
      </div>

      {/* “MediaFrame” but as a real UI example (no missing videos) */}
      <div className="md:col-span-7">
        <MediaFrame
          label="What it looks like"
          title="Capture once. Structure automatically. Ask anything."
          subtitle="Examples shown for illustration"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                Today
              </div>
              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
                Live from logged entries
              </div>
            </div>

            {/* “Captured” row */}
            <div className="mt-4 space-y-2">
              {[
                { t: "Expense logged", d: "Home Depot — $287.40 • Job 18", s: "Confirmed" },
                { t: "Clock in", d: "Mike • Job 18", s: "Active" },
                { t: "Task created", d: "Pick up flashing • Job 18", s: "Assigned" },
                { t: "Revenue logged", d: "Deposit — $2,500 • Job 18", s: "Applied" },
              ].map((row) => (
                <div
                  key={row.t}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white/85">{row.t}</div>
                    <div className="text-xs text-white/55">{row.d}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
                    {row.s}
                  </div>
                </div>
              ))}
            </div>

            {/* “Ask Chief” example */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                Ask Chief (example)
              </div>

              <div className="mt-3 space-y-3">
                <div className="flex justify-end">
                  <div className="max-w-[92%] rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                    <div className="text-xs text-white/50 tracking-[0.16em] uppercase">You</div>
                    <div className="mt-1 text-sm text-white/80">
                      Did Job 18 make money so far?
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <div className="text-xs text-white/50 tracking-[0.16em] uppercase">Chief</div>
                    <div className="mt-1 text-sm text-white/80 leading-relaxed">
                      Job 18 shows <span className="text-white/90 font-semibold">$12,400 revenue</span> and{" "}
                      <span className="text-white/90 font-semibold">$9,980 costs</span> from confirmed entries →{" "}
                      <span className="text-white/90 font-semibold">$2,420 profit</span> (+19.5%).
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Revenue entries: 5", "Cost entries: 21", "Time: 44.0h"].map((x) => (
                        <span
                          key={x}
                          className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/65"
                        >
                          {x}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-white/55">
                      If anything is missing, Chief flags it instead of guessing.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-white/45">
              Example UI. Real answers come from your logged and confirmed records.
            </div>
          </div>
        </MediaFrame>
      </div>
    </div>
  </div>
</Section>

 {/* FAQ */}
<Section id="faq" className="py-14 md:py-24">
  <div className="max-w-3xl">
    <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
      FAQ
    </h2>
    <p className="mt-4 text-white/70 text-lg leading-relaxed">
      Short answers. No fluff.
    </p>
  </div>

  <div className="mt-10">
    <FAQ
      items={[
        {
          q: "Is ChiefOS accounting software?",
          a: "No. ChiefOS is an operating system for running the business day-to-day: time, expenses, tasks, and jobs captured in one place. Export clean data to your accountant or accounting tool.",
        },
        {
          q: "Do my workers need an app?",
          a: "No app download. ChiefOS runs in WhatsApp. Depending on your plan, crew can log from their own phones or the owner can log for the crew.",
        },
        {
          q: "How does Chief answer questions?",
          a: "Chief answers from what you’ve logged and confirmed (time, expenses, revenue, jobs). If something is missing, Chief tells you what’s missing instead of making it up.",
        },
        {
          q: "What if I log something wrong?",
          a: "ChiefOS is built to be repairable: confirmations, undo, edit flows, approvals (plan-dependent), and an audit trail so fixes don’t break trust.",
        },
        {
          q: "Can I export my data?",
          a: "Yes. Export anytime — CSV/XLS/PDF for spreadsheets and accountants, plus downloadable attachments like receipts and voice notes (where applicable). Nothing trapped.",
        },
        {
          q: "Is my data private?",
          a: "Your business data stays scoped to your account. Chief doesn’t answer from other companies’ data, and your team only sees what their role allows.",
        },
        {
          q: "What happens if someone tries to spam my number?",
          a: "ChiefOS uses verification, rate limits, and usage caps to prevent spam and runaway logging. If something looks off, it fails safe instead of filling your books with garbage.",
        },
        {
          q: "What exactly can I capture in WhatsApp?",
          a: "Text, voice, and receipt photos. You can log expenses, revenue, time events, tasks, and job activity — then organize and export it later.",
        },
        {
          q: "How fast can I get set up?",
          a: "Minutes. Start in WhatsApp, answer a couple setup questions, create your first job, and begin logging immediately. Chief starts answering as soon as data exists.",
        },
        {
          q: "What if I already use other tools?",
          a: "Keep them. ChiefOS doesn’t force a rip-and-replace. Use ChiefOS to capture and structure work during the day, then export clean records into whatever tools you already rely on.",
        },
      ]}
    />
  </div>
</Section>
      <SiteFooter
        brandLine="Stop stacking apps. Start running a system."
        subLine="Capture once. Structure automatically. Ask anything."
      />
    </main>
  );
}