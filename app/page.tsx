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
        Grounded answers
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
            Text
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            Audio
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            Receipt photos
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            No invented numbers
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
      Time, money, and jobs captured where you already communicate — in WhatsApp —
      by text, voice, or photo. Structured automatically so your business runs as
      one connected system.
    </p>

    <p className="mt-4 text-base md:text-lg text-white/60 font-medium">
      Stop paying for five apps to run one business.
    </p>

    {/* CTA */}
    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
      <TooltipChip tip="No app download. Works inside WhatsApp.">
        <a
          href="/wa?t=hero"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
            <WhatsAppIcon className="h-5 w-5 text-white translate-y-[0.5px]" />
          </span>
          Start on WhatsApp
        </a>
      </TooltipChip>

      <a
        href="/early-access?plan=starter"
        className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
      >
        Get access
      </a>
    </div>
  </div>

    {/* POWER BLOCK: TOOLS + SENSES (connected) */}
  <div className="mt-14 max-w-4xl mx-auto">
    {/* Relationship header */}
    <div className="mb-4 flex items-center justify-center gap-3 text-xs md:text-sm text-white/55">
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
        Senses capture reality
      </span>
      <span className="text-white/35">→</span>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
        Tools organize the business
      </span>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      {/* TOOLS */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs tracking-[0.18em] uppercase text-white/50">
            Tools
          </div>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/60">
            More coming
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["Expenses", "Time Clock", "Tasks", "Jobs"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-white/80"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="mt-4 text-sm text-white/55 leading-relaxed">
          Track what happened, tied to jobs and totals — not scattered across apps.
        </div>
      </div>

      {/* SENSES */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs tracking-[0.18em] uppercase text-white/50">
            Senses
          </div>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/60">
            More coming
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["Text", "Voice", "Receipt Photo (OCR)", "Email Forward"].map((s) => (
            <span
              key={s}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-white/80"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="mt-4 text-sm text-white/55 leading-relaxed">
          Log any tool using the fastest input in the moment, without switching apps.
        </div>
      </div>
    </div>

    {/* Footnote cue */}
    <div className="mt-4 text-center text-xs text-white/45">
      Same system. Two layers: <span className="text-white/60">how you capture</span> and{" "}
      <span className="text-white/60">what it becomes</span>.
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

    </div>
  </div>
</Section>

      {/* CATEGORY DEFINITION */}
      <Section id="category" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Business Operating System.
              <br />
              Not an app.
            </h2>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Not a tool. Not a chatbot. ChiefOS is the operating layer that makes your tools work together, as one
              system.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="text-sm font-semibold text-white/85">Chief = the financial brain</div>
                <div className="mt-1 text-xs text-white/55">The part that helps you understand the numbers.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="text-sm font-semibold text-white/85">OS = the structure</div>
                <div className="mt-1 text-xs text-white/55">The part that keeps everything connected and usable.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="text-sm font-semibold text-white/85">ChiefOS = your business, running as a system</div>
                <div className="mt-1 text-xs text-white/55">Capture once. Structure automatically. Ask anything.</div>
              </div>
            </div>

            <p className="mt-6 text-white/70 text-lg leading-relaxed">
              Instead of stitching apps together, ChiefOS gives them structure.
              <br />
              Instead of adding complexity, it makes complexity work together.
            </p>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              An operating system doesn’t replace tools.
              <br />
              It makes them operate as one.
            </p>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Connected layer" title="Tools, unified">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Connected activity</div>

                <div className="mt-4 space-y-3">
                  {[
                    { t: "Expense logged", d: "Home Depot — $287.40 • Job 18", s: "Confirmed" },
                    { t: "Clock in", d: "Crew: Mike • Job 18", s: "Shift started" },
                    { t: "Revenue logged", d: "Deposit — $2,500 • Job 18", s: "Applied" },
                    { t: "Task created", d: "Pick up flashing • Job 18", s: "Assigned" },
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
                  Everything ties back to a job. Every number stays traceable.
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* CLEAN SLATE */}
      <Section id="clean-slate" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-6">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Run your business on a system — not a stack.
            </h2>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Right now, your business lives in pieces:
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              {[
                "Time tracking app",
                "Receipt scanner",
                "CRM",
                "Accounting software",
                "Notes in your phone",
                "Spreadsheets at night",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                  <div>{x}</div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-white/70 text-lg leading-relaxed">
              None of it connects.
              <br />
              So when you want to know how a job is performing, you reconstruct it from memory.
            </p>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Switching tabs isn’t management.
              <br />
              It’s survival mode.
            </p>
          </div>

          <div className="md:col-span-6">
            <MediaFrame label="Before vs after" title="From stack → system">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="grid gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Before</div>
                    <div className="mt-2 text-sm text-white/70">
                      Apps everywhere • exports everywhere • spreadsheets at night
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs text-white/55 tracking-[0.16em] uppercase">After</div>
                    <div className="mt-2 text-sm text-white/70">
                      One flow • one structure • one place to ask questions
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-white/45">
                  Clean slate feel: fewer tools to babysit, more clarity to act on.
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* REAL CONVERSATION */}
      <Section id="conversation" className="py-14 md:py-20">
        <div className="max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Be honest. How many apps does it take to run your business?
          </h2>

          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Two owners talking</div>
              <div className="mt-4 space-y-3 text-white/75">
                <div>“What do you use for time?”</div>
                <div>“What do you use for receipts?”</div>
                <div>“What do you use for job costing?”</div>
                <div>“How do you pull it all together?”</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
              <div className="text-xs text-white/55 tracking-[0.16em] uppercase">The quiet answer</div>
              <div className="mt-4 text-lg text-white/80 leading-relaxed">
                “I export everything… and rebuild it in a spreadsheet.”
              </div>

              <div className="mt-6 text-white/70">
                That’s not a system.
                <br />
                <span className="text-white/85 font-semibold">That’s duct tape.</span>
              </div>
            </div>
          </div>
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

      {/* NOTHING TRAPPED */}
      <Section id="exports" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Your data is yours.</h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Export anytime.
              <br />
              CSV. XLS. PDF.
            </p>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Send it to your accountant in one click.
            </p>
            <div className="mt-6 text-lg font-semibold text-white/90">Nothing trapped.</div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Exports" title="Clean records, ready to share">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Download</div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-sm font-semibold text-white/85">CSV</div>
                    <div className="mt-1 text-xs text-white/55">For spreadsheets & imports</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-sm font-semibold text-white/85">XLS</div>
                    <div className="mt-1 text-xs text-white/55">For accountants & review</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="text-sm font-semibold text-white/85">PDF</div>
                    <div className="mt-1 text-xs text-white/55">For filing & sharing</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-white/45">One system in. Clean exports out.</div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* TALK TO YOUR BUSINESS */}
      <Section id="ask" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Talk to your business.</h2>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">Most spreadsheets just sit there.</p>
            <p className="mt-2 text-white/70 text-lg leading-relaxed">ChiefOS doesn’t.</p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              {[
                "“Did we make money on the Hampton job?”",
                "“What did it cost per hour?”",
                "“Where are we overspending?”",
                "“Did we actually make money last month?”",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                  <div>{x}</div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-white/70 text-lg leading-relaxed">
              You get answers based on what you’ve logged.
              <br />
              No guessing. No invented numbers.
            </p>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">Chief uses the records you’ve built.</p>

            <div className="mt-6 text-sm text-white/55">
              Behind the scenes, intelligent systems organize and reason over your data — so you don’t have to.
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Ask Chief"
              title="Ask a real question. Get a grounded answer."
              subtitle="Answers reflect what’s logged and confirmed"
              videoSrc="/loops/homecoming.mp4"
              posterSrc="/loops/homecoming.jpg"
            />
          </div>
        </div>
      </Section>

      {/* VALUE CARDS (Outcome-forward) */}
      <Section id="value" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            What you gain when tools finally work together
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            This isn’t “more features.” It’s fewer gaps, less cleanup, and better decisions.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-5">
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
              p: "Assign and track tasks linked to time and money. For teams: approvals, permissions, audit trails.",
            },
            {
              h: "Records, Clean",
              p: "Export pristine data anytime — CSV, XLS, PDF. Nothing trapped. Nothing rebuilt.",
            },
            {
              h: "Answers, On Demand",
              p: "Ask real questions about jobs, margins, and costs. Get answers grounded in your records.",
            },
          ].map((x) => (
            <div key={x.h} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="text-lg font-semibold text-white/90">{x.h}</div>
              <p className="mt-2 text-sm text-white/70">{x.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* SCOREBOARD (keep terminal proof, remove truth language) */}
      <Section id="scoreboard" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Margin is the scoreboard.
              <br />
              Jobs are the standings.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              ChiefOS shows your business job by job — with numbers you can trace back to what was logged.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Clear job margin.</span>{" "}
                  Revenue – (Labour + Expenses). No mystery math.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Payroll-grade shift clarity.</span>{" "}
                  Breaks and drive are tracked distinctly.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Traceable answers.</span>{" "}
                  Every number has a source.
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Business terminal" title="Live overview (example)">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Dashboard</div>
                  <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
                    MTD
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Cash In" value="$148,240" delta="+8.4%" hint="Month-to-date" />
                  <StatCard label="Cash Out" value="$103,910" delta="+4.1%" hint="Month-to-date" />
                  <StatCard label="Net Position" value="$44,330" delta="+15.7%" hint="In – Out" />
                  <StatCard label="Open Invoices" value="$26,400" hint="Outstanding" />
                  <StatCard label="Unbilled Labour" value="38.5h" hint="This week" />
                  <StatCard label="Labour Today" value="7.0h" hint="Active shifts" />
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Jobs standings</div>
                    <div className="text-[11px] text-white/50">Sortable • Filterable</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {[
                      { job: "Job 18 — Medway Dr", rev: "$12,400", cost: "$9,980", lab: "44.0h", margin: "+19.5%", status: "Open" },
                      { job: "Job 12 — Pine Ave", rev: "$7,850", cost: "$6,910", lab: "31.5h", margin: "+12.0%", status: "Open" },
                      { job: "Job 09 — King St", rev: "$5,100", cost: "$5,620", lab: "22.0h", margin: "-10.2%", status: "Risk" },
                    ].map((r) => (
                      <div
                        key={r.job}
                        className="grid grid-cols-12 items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                      >
                        <div className="col-span-6">
                          <div className="text-sm font-semibold text-white/85">{r.job}</div>
                          <div className="text-xs text-white/55">
                            Rev {r.rev} • Cost {r.cost} • Labour {r.lab}
                          </div>
                        </div>

                        <div className="col-span-3 text-right">
                          <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Margin</div>
                          <div className="text-sm font-semibold text-white/85">{r.margin}</div>
                        </div>

                        <div className="col-span-3 flex justify-end">
                          <div className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] text-white/60">
                            {r.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-white/45">
                    Example UI. Your standings are driven by what you log.
                  </div>
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* TIMESHEET CLARITY */}
      <Section id="time" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Not a timer.
              <br />
              Payroll-grade shift clarity.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Shift time is not one number. ChiefOS tracks the categories that actually matter — legally and financially.
            </p>

            <div className="mt-6 space-y-2">
              <FeatureRow k="Shift time" v="Recorded" />
              <FeatureRow k="Break time" v="Recorded (separate)" />
              <FeatureRow k="Lunch time" v="Recorded (separate)" />
              <FeatureRow k="Drive time" v="Tracked (not deducted)" />
              <FeatureRow k="Work time" v="Calculated" />
              <FeatureRow k="Paid time" v="Calculated" />
            </div>

            <div className="mt-4 text-xs text-white/45">
              Built for repairs: confirmations, undo actions, approvals, and an audit trail so corrections don’t destroy trust.
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Time categories"
              title="Shift categories that don’t collapse into guesses"
              subtitle="Shift • Break • Lunch • Drive • Work • Paid"
              videoSrc="/loops/job-spine.mp4"
              posterSrc="/loops/job-spine.jpg"
            />
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

    {/* SOCIAL PROOF (Relief > buzzwords) */}
<Section id="proof" className="py-14 md:py-20">
  <div className="max-w-3xl">
    <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
      What owners say
    </h2>
    <p className="mt-4 text-white/70 text-lg leading-relaxed">
      No buzzwords. Just relief.
    </p>
  </div>

  <div className="mt-10 grid gap-6 md:grid-cols-2">
    {[
      {
        q: "“I finally know what’s going on.”",
        s: "Jobs stopped being a mystery.",
      },
      {
        q: "“It feels like everything talks to each other now.”",
        s: "Time, money, and tasks stopped living in different places.",
      },
      {
        q: "“I’m not rebuilding my business at night anymore.”",
        s: "Capture happens during the day. Understanding shows up right after.",
      },
      {
        q: "“When someone asks if we made money, I can answer.”",
        s: "Not a guess. Not a feeling. The record is right there.",
      },
    ].map((t) => (
      <div
        key={t.q}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
      >
        <div className="text-lg text-white/85 leading-relaxed">{t.q}</div>
        <div className="mt-3 text-sm text-white/55">{t.s}</div>
      </div>
    ))}
  </div>

  <div className="mt-6 text-xs text-white/45">
    These are examples of the outcomes ChiefOS is built to create: clarity → control → confidence.
  </div>
</Section>

      {/* FINAL CLOSE */}
      <Section className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Of course your business should run from one place.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Run your business on a system — not a stack.
            </p>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Start on WhatsApp. Get set up in minutes. See your business clearly.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 overflow-visible">
              <TooltipChip tip="Fastest path: start free on WhatsApp.">
                <a
                  href="/wa?t=cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
                >
                  <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
                    <WhatsAppIcon className="h-5 w-5 text-white translate-y-[0.5px]" />
                  </span>
                  Start Free
                </a>
              </TooltipChip>

              <a
                href="/early-access?plan=starter"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Get it now
              </a>
            </div>

            <div className="mt-3 text-xs text-white/45">
              Built for serious operators. Structured records first. Answers second.
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="One system"
              title="Capture once. Structure automatically. Ask anything."
              subtitle="The operating layer your business was missing"
              videoSrc="/loops/hero-split.mp4"
              posterSrc="/loops/hero-split.jpg"
            />
          </div>
        </div>
      </Section>

      {/* FAQ (edited to avoid “truth/reality” language) */}
      <Section id="faq" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">FAQ</h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">Short answers. No fluff.</p>
        </div>

        <div className="mt-10">
          <FAQ
            items={[
              {
                q: "Is this accounting software?",
                a: "No. ChiefOS is a business operating layer: it captures work as it happens, ties it to jobs, and keeps records structured so you can export what you need and understand what’s going on.",
              },
              {
                q: "Do my workers need an app?",
                a: "No. ChiefOS is WhatsApp-first. On Pro, crew can self-log from their own phones. On Free and Starter, owners log for crew.",
              },
              {
                q: "Will Chief guess my numbers?",
                a: "No. Chief answers based on what’s been logged and confirmed. If something is missing, Chief tells you exactly what’s missing.",
              },
              {
                q: "What if I make a mistake?",
                a: "ChiefOS is built to be repairable: confirmations, undo, approvals (Pro), and an audit trail so corrections don’t destroy trust.",
              },
              {
                q: "Can I get my data out?",
                a: "Yes. Exports are included, and paid plans are designed to be reversible. Nothing trapped.",
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