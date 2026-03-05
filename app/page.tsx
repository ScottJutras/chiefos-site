// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\page.tsx
// ChiefOS marketing homepage (Command-centre vibe + contractor clarity)
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
import React from "react";
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
    "Know if you’re making money—instantly. ChiefOS is a WhatsApp-first operating system for contractors: capture time + money on the go, connect everything to jobs, and ask your business questions grounded in your logged records.",
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
        <div className="text-[11px] tracking-[0.16em] uppercase text-white/55">
          {label}
        </div>
        {delta ? (
          <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/65">
            {delta}
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </div>
  );
}

function PlanCard({
  name,
  sub,
  price,
  badge,
  bullets,
  ctaHref,
  ctaLabel,
  foot,
}: {
  name: string;
  sub: string;
  price: string;
  badge?: string;
  bullets: string[];
  ctaHref: string;
  ctaLabel: string;
  foot?: string;
}) {
  const btnBase =
    "mt-6 inline-flex w-full items-center justify-center rounded-2xl h-11 px-4 text-sm font-semibold transition";

  return (
    <div className="relative flex h-full flex-col rounded-[28px] border border-white/10 bg-white/5 p-6 md:p-7">
      {badge && (
        <div className="absolute -top-3 left-6 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-xs text-white/70 backdrop-blur">
          {badge}
        </div>
      )}

      <div>
        <div className="text-sm font-semibold text-white/80">{name}</div>
        <div className="mt-1 text-white/60 text-sm">{sub}</div>

        <div className="mt-4 flex items-end gap-2">
          <div className="text-4xl font-bold tracking-tight">{price}</div>
          <div className="pb-1 text-sm text-white/60">/ month</div>
        </div>

        <div className="mt-6 space-y-3">
          {bullets.map((b) => (
            <div key={b} className="flex items-start gap-3 text-sm text-white/70">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-white/40" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <div>
        <a href={ctaHref} className={`${btnBase} bg-white text-black hover:bg-white/90`}>
          {ctaLabel}
        </a>

        {foot && (
          <div className="mt-4 text-xs text-white/50 leading-relaxed">{foot}</div>
        )}
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
                    Your business answers back
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
            Did Job 18 make money?
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            Where did my margin go?
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            What did labour cost last week?
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            Answers grounded in logged records — no guessing.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function WhyDifferentTable() {
  const rows = [
    { left: "You log data", right: "You log & ask" },
    { left: "You run reports", right: "You get answers" },
    { left: "Dashboards everywhere", right: "Conversational CFO" },
    { left: "Time tracking as a timer", right: "Job-level intelligence" },
    { left: "Accountants tell you later", right: "You know now" },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-7">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
          Why ChiefOS is different
        </div>
        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
          Control → clarity → confidence
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {rows.map((r) => (
          <div
            key={r.left}
            className="grid grid-cols-12 gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
          >
            <div className="col-span-5 text-sm text-white/65">{r.left}</div>
            <div className="col-span-2 text-center text-white/35">→</div>
            <div className="col-span-5 text-sm font-semibold text-white/85">
              {r.right}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-white/45">
        The magic isn’t “AI.” The magic is you don’t have to dig.
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

   {/* HERO */}
<Section id="top" className="pt-8 md:pt-10 pb-14 md:pb-18">
  <div className="max-w-4xl mx-auto text-center">
    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/70">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
      Contractor Grade Business Intelligence
    </div>

    <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
      Know if you’re making money.
      <br />
      Instantly.
    </h1>

    <p className="mt-5 text-lg md:text-xl text-white/75 leading-relaxed">
      ChiefOS captures time, expenses, and job activity where work happens and
      turns it into answers about your business.
    </p>

    <p className="mt-4 text-base md:text-lg text-white/60 font-medium">
      Ask your business a question. Get an answer.
      <br />
      Powered by intelligent job-level analysis grounded in your records.
    </p>

    {/* CTA */}
    <HeroGetStartedForm pricingHref="/pricing" />

    <div className="mt-5 text-sm md:text-base text-white/70 leading-relaxed">
      <span className="text-white/80 font-semibold">
        Text it → Say it → Snap it → Confirm → Done.
      </span>
      <br />
      Clean records. Clean exports.
    </div>
  </div>


        {/* QUICK PROOF + DIFFERENTIATION */}
        <div className="mt-12 max-w-5xl mx-auto grid gap-6 md:grid-cols-12 items-start">
          <div className="md:col-span-7">
            <MediaFrame
              label="Ask Chief"
              title="Ask a real question. Get a grounded answer."
              subtitle="Examples shown for illustration"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                    Conversation (example)
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
                    Based on confirmed entries
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "Did Job 18 make money?",
                    "Where did my margin go?",
                    "Cost per hour last week?",
                    "What’s unbilled today?",
                  ].map((q) => (
                    <span
                      key={q}
                      className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70"
                    >
                      {q}
                    </span>
                  ))}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                      <div className="text-xs text-white/50 tracking-[0.16em] uppercase">
                        You
                      </div>
                      <div className="mt-1 text-sm text-white/80">
                        Did Job 18 make money so far?
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                      <div className="text-xs text-white/50 tracking-[0.16em] uppercase">
                        Chief
                      </div>
                      <div className="mt-1 text-sm text-white/80 leading-relaxed">
                        Job 18 shows{" "}
                        <span className="text-white/90 font-semibold">
                          $12,400 revenue
                        </span>{" "}
                        and{" "}
                        <span className="text-white/90 font-semibold">
                          $9,980 costs
                        </span>{" "}
                        from confirmed entries →{" "}
                        <span className="text-white/90 font-semibold">
                          $2,420 profit
                        </span>{" "}
                        (+19.5%).
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {["Revenue entries: 5", "Cost entries: 21", "Time: 44.0h"].map(
                          (x) => (
                            <span
                              key={x}
                              className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-white/65"
                            >
                              {x}
                            </span>
                          )
                        )}
                      </div>

                      <div className="mt-3 text-xs text-white/55">
                        If something is missing, Chief tells you what’s missing instead of guessing.
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

          <div className="md:col-span-5">
            <WhyDifferentTable />
          </div>
        </div>
      </Section>

      {/* SYSTEM OVERVIEW */}
      <Section id="system" className="pb-16 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            A command centre for job truth.
          </h2>
          <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed">
            Most owners don’t know true margin, don’t track labour cleanly, and can’t answer profit questions quickly.
            ChiefOS fixes that by connecting time, money, and tasks to every job.
          </p>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            ChiefOS reduces anxiety. Increases Focus.{" "}
            <span className="text-white/85 font-semibold">Dials-in your margins.</span>
          </p>
        </div>

        <div className="mt-14 max-w-4xl mx-auto">
          <div className="mb-6 flex items-center justify-center gap-4 text-sm text-white/50">
            <span>Capture on-the-go</span>
            <span className="text-white/35">→</span>
            <span>Structured job records</span>
            <span className="text-white/35">→</span>
            <span>Answers on demand</span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
              <div className="text-xl md:text-2xl font-semibold text-white">
                Capture
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["Text", "Voice", "Receipt Photo (OCR)"].map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-sm text-white/85"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5 text-sm text-white/60 leading-relaxed">
                No app switching. No forms. Log it while you’re moving.
              </div>

              <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
                More inputs coming
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
              <div className="text-xl md:text-2xl font-semibold text-white">
                Connect & Integrate
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
                Every entry becomes structured, tied to jobs, and traceable back to who logged it.
              </div>

              <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
                More tools coming
              </div>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-white/45">
            If it’s not tracked, it’s not profit.
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

          <div className="md:col-span-2">
            <ToolCard
              title="Chief"
              featured
              icon={<ChiefIcon className="h-8 w-8 text-white" />}
              blurb="Chief sits under every tool, linking jobs, time, and money into one record. It answers only from what’s been logged, tells you what’s missing, and never guesses."
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

            <div className="mt-6 text-lg font-semibold text-white/90">Nothing trapped.</div>
          </div>

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

      {/* STACK → SYSTEM */}
      <Section id="stack-system" className="py-14 md:py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Stop stacking apps.
            <br />
            Start running a system.
          </h2>

          <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
            Most owners patch together time tracking, receipts, CRM, accounting, and spreadsheets.
            ChiefOS replaces the stack with one connected system — and lets you ask questions instead of digging.
          </p>

          <div className="mt-10">
            <StackVsChief variant="wide" />
          </div>

          <div className="mt-6 text-xs text-white/45 max-w-3xl mx-auto">
            Typical pricing varies by vendor and plan. This comparison is a conservative snapshot to show the cost of
            fragmentation (exports, re-entry, and rebuilding jobs by hand).
          </div>
        </div>
      </Section>

      {/* PLANS */}
      <Section id="pricing-preview" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Start with capture. Grow into profit control.
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Free builds the habit. Starter adds answers. Pro adds crew controls — without losing speed.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <PlanCard
            name="Free"
            sub="Field Capture"
            price="$0"
            badge="Starting out"
            bullets={[
              "1 Owner",
              "3 Jobs",
              "Text capture",
              "Core tools: Time + Expenses + Tasks + Jobs",
              "Exports",
              "WhatsApp Logging",
            ]}
            ctaHref="/wa?t=free"
            ctaLabel="Get it now"
            foot="Start logging. Start seeing the truth."
          />

          <PlanCard
            name="Starter"
            sub="Owner Mode"
            price="$59"
            badge="Most popular"
            bullets={[
              "Ask Chief. Intelligence Layer",
              "1 Owner",
              "Track up to 10 employees",
              "25 Jobs",
              "Text, Voice, Images",
              "Core tools + job connections",
              "Exports",
              "WhatsApp Logging",
            ]}
            ctaHref="/pricing?plan=starter"
            ctaLabel="Buy Now"
            foot="Stop guessing. Start answering."
          />

          <PlanCard
            name="Pro"
            sub="Crew + Control"
            price="$149"
            badge="Teams"
            bullets={[
              "Ask Chief. Intelligence Layer",
              "1 Owner",
              "Up to 150 employees: log",
              "Up to 25 admins: log + approve + edit",
              "Unlimited jobs",
              "Text, Voice, Images",
              "Exports",
              "WhatsApp Logging",
              "Approvals + audit trail",
              "Priority onboarding",
            ]}
            ctaHref="/pricing?plan=pro"
            ctaLabel="Buy Now"
            foot="A command centre for teams."
          />
        </div>

        <div className="mt-6 text-xs text-white/45">
          Your data is yours. All plans include exports — nothing trapped.
        </div>
      </Section>

      {/* STOP THE NIGHT SHIFT */}
      <Section id="night-shift" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Stop the night shift.
            </h2>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Most owners spend 30 minutes to 1.5 hours a day:
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              {["Cleaning receipts", "Updating spreadsheets", "Reconciling entries", "Moving data between apps"].map(
                (x) => (
                  <div key={x} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                    <div>{x}</div>
                  </div>
                )
              )}
            </div>

            <p className="mt-6 text-white/70 text-lg leading-relaxed">
              And at the end of it? The data just sits there.
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
              Text it. <span className="text-white/60">Say it.</span>{" "}
              <span className="text-white/60">Snap it.</span>
            </div>

            <div className="mt-2 text-sm text-white/70">Confirm. Done.</div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Capture flow" title="Capture → confirm → stored clean">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                  Example
                </div>

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
              Built to be repairable: confirmations, undo actions, approvals, and an audit trail — so corrections don’t destroy trust.
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Time categories"
              title="A shift that stays traceable"
              subtitle="Shift • Break • Lunch • Drive • Work • Paid"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                    Example shift
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60">
                    Job 18 • Medway Dr
                  </div>
                </div>

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

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                    Timeline
                  </div>

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

                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Shift" value="9.5h" hint="Clock in → out" />
                  <StatCard label="Break" value="0.3h" hint="Separate" />
                  <StatCard label="Lunch" value="0.5h" hint="Separate" />
                  <StatCard label="Drive" value="0.8h" hint="Tracked" />
                  <StatCard label="Work" value="8.7h" hint="Calculated" />
                  <StatCard label="Paid" value="9.5h" hint="Rules-based" />
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-xs text-white/55 tracking-[0.16em] uppercase">
                    Example question
                  </div>
                  <div className="mt-2 text-sm text-white/75 leading-relaxed">
                    <span className="text-white/85 font-semibold">Q:</span> “How many paid hours did Mike work on Job 18 today?”
                    <br />
                    <span className="text-white/85 font-semibold">A:</span> “Mike has{" "}
                    <span className="text-white/90 font-semibold">9.5 paid hours</span> on Job 18 today.
                    Work time is 8.7h (shift − breaks − lunch) plus 0.8h drive tracked separately.”
                  </div>
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* FINAL CLOSE */}
      <Section id="close" className="py-14 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Ask your business anything.
              <br />
              Get answers instantly.
            </h2>

            <p className="mt-4 text-white/70 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
              Capture time, money, and job activity where work happens — then ask Chief what it means.
              Powered by intelligent job-level analysis, grounded in your records.
            </p>

            <div className="mt-4 text-sm md:text-base text-white/70 leading-relaxed">
              <span className="text-white/80 font-semibold">
                Text it → Say it → Snap it → Confirm → Done.
              </span>
              <br />
              Clean records. Clean exports.
            </div>

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
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-14 md:py-24">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">FAQ</h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">Short answers. No fluff.</p>
        </div>

        <div className="mt-10">
          <FAQ
            items={[
              {
                q: "Is ChiefOS accounting software?",
                a: "No. ChiefOS is the operating system for running the business day-to-day: time, expenses, tasks, and jobs captured in one place. Export clean data to your accountant or accounting tool.",
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
        brandLine="Know if you’re making money — instantly."
        subLine="Text it → Say it → Snap it → Confirm → Done. Clean records. Clean exports."
      />
    </main>
  );
}