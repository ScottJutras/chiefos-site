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

export const metadata = {
  title: "ChiefOS",
  description:
    "ChiefOS is a WhatsApp-first operating system for contractors. Start with receipts. Tie everything to the job. See payroll-grade time. Ask Chief for answers grounded in your own data.",
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

function FeatureRow({
  k,
  v,
}: {
  k: string;
  v: string;
}) {
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

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      {/* HERO (Private banking / terminal) */}
      <Section id="top" className="pt-28 md:pt-32 pb-14 md:pb-20">
        <div className="grid gap-10 md:gap-12 md:grid-cols-12 items-start">
          <div className="md:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-white/60" />
              Built for contractors. Evidence-first. Exportable on paid plans.
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.03]">
              Start with receipts.
              <br />
              End with job truth.
            </h1>

            <p className="mt-4 text-lg md:text-xl text-white/80 leading-relaxed">
              ChiefOS is a WhatsApp-first operating system for contractors.
            </p>

            <p className="mt-3 text-lg md:text-xl text-white/70 leading-relaxed">
              Log receipts, time, revenue, and tasks in real time — tied to the job — then ask Chief what it actually means.
              No guesses. No dashboard theater.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 overflow-visible">
              <TooltipChip tip="No app download. Works inside WhatsApp.">
                <a
                  href="/wa?t=hero"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
                >
                  <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
                    <WhatsAppIcon className="h-5 w-5 text-white translate-y-[0.5px]" />
                  </span>
                  Start on WhatsApp
                </a>
              </TooltipChip>

              <a
                href="/early-access?plan=starter"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Get early access
              </a>

              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Sign in
              </a>
            </div>

            <div className="mt-3 text-xs text-white/50">
              Owners can ask questions. Crew capture is plan-dependent — you stay in control.
            </div>

            {/* Terminal-like trust chips */}
            <div className="mt-7 grid grid-cols-2 gap-3 text-xs text-white/60">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white/80">Evidence-based answers</div>
                <div className="mt-1">Chief only answers from what’s been logged and confirmed.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white/80">Jobs are the spine</div>
                <div className="mt-1">Time + expenses + revenue + tasks anchored to the job that caused them.</div>
              </div>
            </div>

            {/* “Investor polish” micro line */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/60">
              Stripe-backed subscriptions • Plan enforcement • Tenant-isolated data
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Terminal overview"
              title="Your business, as-live"
              subtitle="Receipts + time + revenue → job margin you can trust"
              videoSrc="/loops/hero-split.mp4"
              posterSrc="/loops/hero-split.jpg"
            />
          </div>
        </div>
      </Section>

      {/* PROBLEM (Night admin) */}
      <Section id="problem" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Most contractors don’t lose money in the field.
              <br />
              They lose it at night.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              When reality gets reconstructed instead of captured, numbers turn into arguments. Time turns into guesses.
              “Profit” turns into a feeling.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              {[
                "Receipts sit in trucks",
                "Time gets estimated later",
                "Jobs blur together",
                "Payroll gets rebuilt from memory",
                "You find problems after the money is gone",
              ].map((x) => (
                <div key={x} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                  <div>{x}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Reality feed" title="Capture → confirm → traceable">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Activity</div>

                <div className="mt-4 space-y-3">
                  {[
                    { t: "Receipt logged", d: "Home Depot — $287.40 • Job 18", s: "Confirmed" },
                    { t: "Clock in", d: "Crew: Mike • Job 18", s: "Shift started" },
                    { t: "Revenue logged", d: "Deposit — $2,500 • Job 18", s: "Applied" },
                    { t: "Task created", d: "Pick up flashing • Job 18", s: "Assigned" },
                  ].map((row) => (
                    <div key={row.t} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
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

      {/* HOW IT WORKS (4-step loop) */}
      <Section id="how" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-white/60" />
            Simple loop. Compounding clarity.
          </div>

          <h2 className="mt-6 text-3xl md:text-4xl font-semibold tracking-tight">
            Capture → Attach → Calculate → Ask
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            ChiefOS is built around one habit: capture reality while it’s happening. Everything else becomes inevitable.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-4">
          {[
            {
              step: "1",
              h: "Capture",
              p: "Send a receipt photo, a note, or voice. No app. No menus.",
            },
            {
              step: "2",
              h: "Attach to the job",
              p: "Every dollar and hour gets anchored to the job that caused it.",
            },
            {
              step: "3",
              h: "Calculate time truth",
              p: "Shift, break, lunch, drive, work, paid — tracked distinctly.",
            },
            {
              step: "4",
              h: "Ask Chief",
              p: "Get answers grounded in logged data. If something’s missing, Chief says so.",
            },
          ].map((x) => (
            <div key={x.h} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="text-[11px] tracking-[0.16em] uppercase text-white/55">Step {x.step}</div>
              <div className="mt-2 text-lg font-semibold text-white/90">{x.h}</div>
              <p className="mt-2 text-sm text-white/70">{x.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* TERMINAL SECTION (Margin scoreboard) */}
      <Section id="scoreboard" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Margin is the scoreboard.
              <br />
              Jobs are the standings.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              ChiefOS doesn’t “report.” It shows your business as-live — job by job — with numbers you can trace back to the evidence.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Deterministic job margin.</span>{" "}
                  Revenue – (Labour + Expenses). No mystery math.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Payroll-grade time truth.</span>{" "}
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
                    Example UI. Your real standings are driven by your own logs.
                  </div>
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* TIMESHEET TRUTH (Signature differentiator) */}
      <Section id="time" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Not a timer.
              <br />
              Payroll-grade shift truth.
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
              Built for repairs: undo actions, approvals, and an audit trail so corrections don’t destroy trust.
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Time truth"
              title="Time categories that don’t collapse into guesses"
              subtitle="Shift • Break • Lunch • Drive • Work • Paid"
              videoSrc="/loops/job-spine.mp4"
              posterSrc="/loops/job-spine.jpg"
            />
          </div>
        </div>
      </Section>

      {/* PLANS (Operational maturity, not feature ladder) */}
      <Section id="pricing-preview" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Plans that match operational maturity.
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Start capturing. Upgrade when you hit a real boundary — OCR speed, exports, or crew self-logging.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <PlanCard
            name="Free"
            sub="Field Capture"
            price="$0"
            badge="Start here"
            bullets={[
              "Log the basics via WhatsApp",
              "Jobs + expenses + revenue + time (manual)",
              "Limited jobs & history",
              "No OCR, no exports",
            ]}
            ctaHref="/wa?t=free"
            ctaLabel="Start on WhatsApp"
            foot="Free is for capture. Paid is for speed + control."
          />

          <PlanCard
            name="Starter"
            sub="Owner Mode"
            price="$29"
            badge="Most popular"
            bullets={[
              "OCR + voice for fast capture",
              "Ask Chief (owner-only)",
              "Exports included",
              "Owner logs for crew",
            ]}
            ctaHref="/early-access?plan=starter"
            ctaLabel="Get early access"
            foot="Best for owner-operators who want answers quickly."
          />

          <PlanCard
            name="Pro"
            sub="Crew + Control"
            price="$79"
            badge="Teams"
            bullets={[
              "Crew self-logs from their own phones",
              "Approvals + deeper audit",
              "Board seats (advisors/bookkeepers)",
              "Higher limits & longer history",
            ]}
            ctaHref="/early-access?plan=pro"
            ctaLabel="Join Pro early access"
            foot="Crew captures. Owner approves. Chief explains."
          />
        </div>

        <div className="mt-6 text-xs text-white/45">
          You can change plans anytime. Paid plans are designed to be reversible (exports) — nothing trapped.
        </div>
      </Section>

      {/* CTA (Conversion close) */}
      <Section className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Know where you stand — job by job.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Start with one receipt. Tie it to a job. Then ask Chief a question you’ve been guessing at for months.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 overflow-visible">
              <TooltipChip tip="Fastest path: log your first receipt.">
                <a
                  href="/wa?t=cta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
                >
                  <span className="inline-grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30">
                    <WhatsAppIcon className="h-5 w-5 text-white translate-y-[0.5px]" />
                  </span>
                  Log your first receipt (free)
                </a>
              </TooltipChip>

              <a
                href="/early-access?plan=starter"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition hover:-translate-y-[1px] active:translate-y-0"
              >
                Get early access
              </a>
            </div>

            <div className="mt-3 text-xs text-white/45">
              If you stop using it, paid plans let you export your records. Trust is the product.
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Chief answers"
              title="Ask a real question. Get a grounded answer."
              subtitle="“Did Job 18 make money?” → breakdown based on logged transactions"
              videoSrc="/loops/homecoming.mp4"
              posterSrc="/loops/homecoming.jpg"
            />
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">FAQ</h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Short answers. No fluff. Trust over cleverness.
          </p>
        </div>

        <div className="mt-10">
          <FAQ
            items={[
              {
                q: "Is this accounting software?",
                a: "No. ChiefOS captures operational truth as it happens — tied to jobs — so you can understand what happened and why. You can export what you need for bookkeeping on paid plans.",
              },
              {
                q: "Do my workers need an app?",
                a: "No. ChiefOS is WhatsApp-first. On Pro, crew can self-log from their own phones. On Free and Starter, owners log for crew.",
              },
              {
                q: "Will ChiefOS guess my profit?",
                a: "No. Chief answers based on what’s been logged and confirmed. If something is missing, Chief will tell you exactly what’s missing.",
              },
              {
                q: "What if I make a mistake?",
                a: "ChiefOS is built to be repairable: confirmations, undo, approvals (Pro), and an audit trail so corrections don’t destroy trust.",
              },
              {
                q: "Can I get my data out?",
                a: "Yes. Paid plans are designed to be reversible with exports. Nothing trapped.",
              },
            ]}
          />
        </div>
      </Section>

      <SiteFooter
        brandLine="Start with receipts. End with job truth."
        subLine="Capture real work. Understand real jobs."
      />
    </main>
  );
}
