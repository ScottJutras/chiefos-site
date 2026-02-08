// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\page.tsx
// ChiefOS marketing homepage (Cash App / Apple scroll-story vibe)
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
    "ChiefOS is an AI-native operating system for contractors and service businesses. Capture reality in real time. Understand job profitability. Get answers you can trust.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      {/* HERO */}
      <Section id="top" className="pt-28 md:pt-32 pb-14 md:pb-20">
        <div className="grid gap-10 md:gap-12 md:grid-cols-12 items-center">
          <div className="md:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-white/60" />
              Built for contractors. Privacy-first by design.
            </div>

            <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Run your business
              <br />
              by texting it.
            </h1>

            <p className="mt-4 text-lg md:text-xl text-white/80 leading-relaxed">
              ChiefOS puts reality into the equation.
            </p>

            <p className="mt-3 text-lg md:text-xl text-white/70 leading-relaxed">
              Snap receipts. Log hours. Track jobs. Ask Chief for real answers — grounded in your own data.
            </p>

            {/* ✅ overflow-visible prevents tooltip clipping */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 overflow-visible">
        <TooltipChip tip="No app download. Works inside WhatsApp.">
            <a
              href="/wa?t=hero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition hover:-translate-y-[1px] active:translate-y-0"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                <WhatsAppIcon className="h-5 w-5 text-white/90" />
              </span>
              Add Chief on WhatsApp
            </a>
        </TooltipChip>


              <a
                href="/early-access"
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

            <p className="mt-2 text-xs text-white/45">
              No app download. Works inside WhatsApp.
            </p>

            <p className="mt-3 text-xs text-white/50">
              Owners can ask questions. Crew can only log what you allow.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-white/60">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white/80">Reality first</div>
                <div className="mt-1">No fabricated answers. Everything is auditable.</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold text-white/80">Jobs are the spine</div>
                <div className="mt-1">Time + expenses + revenue anchored to the job.</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Hero loop"
              title="Old way vs ChiefOS"
              subtitle="Nightly cleanup → generic totals • On-site capture → explainable answers"
              videoSrc="/loops/hero-split.mp4"
              posterSrc="/loops/hero-split.jpg"
            />
          </div>
        </div>
      </Section>

      {/* ONE OS */}
      <Section id="product" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              One OS replaces the patchwork.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Most contractors stitch together time apps, receipt scanners, accounting, notes, and spreadsheets.
              That creates gaps. Gaps create surprises.
            </p>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              ChiefOS captures what happened, when it happened, and what job it belongs to — so you get
              understanding, not just totals.
            </p>
          </div>

          <div className="md:col-span-7">
            <MediaFrame label="Comparison (placeholder)" title="Traditional stack → ChiefOS">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-white/70">
                  {["Time Clock App", "Receipt Scanner", "Accounting", "Calendar/Notes", "Spreadsheets"].map((x) => (
                    <div key={x} className="rounded-xl border border-white/10 bg-black/30 p-3">
                      {x}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center">
                  <div className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs text-white/70">
                    ↓ replaced by
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="text-sm font-semibold">ChiefOS</div>
                  <div className="mt-1 text-xs text-white/60">
                    Receipts • Time • Revenue • Tasks • Job spine • Explainable answers
                  </div>
                </div>
              </div>
            </MediaFrame>
          </div>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section id="how" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Log your business in real life — not after hours.
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Short, repeatable loops. Capture → confirm → anchored to the job. That’s how understanding compounds.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-white/60">STEP 1</div>
            <div className="mt-2 text-lg font-semibold">Snap & confirm</div>
            <p className="mt-2 text-sm text-white/70">
              Receipt photo → parsed fields → quick confirm/edit → saved with evidence.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-white/60">STEP 2</div>
            <div className="mt-2 text-lg font-semibold">Time by voice</div>
            <p className="mt-2 text-sm text-white/70">
              “Clock in crew.” “Break.” “Drive.” “Clock out.” Undo mistakes instantly.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-white/60">STEP 3</div>
            <div className="mt-2 text-lg font-semibold">Ask Chief</div>
            <p className="mt-2 text-sm text-white/70">
              “How much am I making on 18 Main St?” Answers grounded in your own logs.
            </p>
          </div>
        </div>
      </Section>

      {/* SIGNATURE DIFFERENTIATOR */}
      <Section id="why" className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Totals aren’t guidance.
              <br />
              ChiefOS puts reality into the equation.
            </h2>

            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Most tools only see your business after you clean it up. ChiefOS captures reality first — timing, evidence,
              intent — then builds explainable job-level truth.
            </p>

            <div className="mt-6 space-y-3 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Jobs are the backbone of truth.</span>{" "}
                  Receipts, time, revenue, tasks — attached to the job that caused them.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Auditable answers.</span>{" "}
                  Every number ties back to the underlying evidence.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-white/60" />
                <div>
                  <span className="text-white/85 font-semibold">Reality captured once.</span>{" "}
                  No end-of-month rebuild.
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Reality capture"
              title="Job spine timeline"
              subtitle="Receipts + time + revenue + tasks → job truth → explainable answers"
              videoSrc="/loops/job-spine.mp4"
              posterSrc="/loops/job-spine.jpg"
            />
          </div>
        </div>
      </Section>

      {/* USE CASES */}
      <Section id="use-cases" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Built for the trades. Built to be trusted.
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            ChiefOS is not “another dashboard.” It’s an operating system that understands your business because it
            captured reality first.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              h: "Job profitability",
              p: "Know which jobs are winners, which are leaking, and why — with evidence, not guesses.",
            },
            {
              h: "Fast capture",
              p: "Log on-site while it’s happening. No admin nights. No missing receipts.",
            },
            {
              h: "Instant recall",
              p: "Find receipts, time, revenue, and notes without digging through folders.",
            },
          ].map((x) => (
            <div key={x.h} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-semibold">{x.h}</div>
              <p className="mt-2 text-sm text-white/70">{x.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* EMOTIONAL PAYOFF */}
      <Section className="py-14 md:py-20">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Get your evenings back.
            </h2>
            <p className="mt-4 text-white/70 text-lg leading-relaxed">
              Contractors shouldn’t rebuild the business at 10 PM. Capture it once, in real time — and use that time where
              it actually matters.
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href="/early-access"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                Get early access
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Sign in
              </a>
            </div>
          </div>

          <div className="md:col-span-7">
            <MediaFrame
              label="Lifestyle loop"
              title="Homecoming moment"
              videoSrc="/loops/homecoming.mp4"
              posterSrc="/loops/homecoming.jpg"
            />
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-14 md:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            FAQ
          </h2>
          <p className="mt-4 text-white/70 text-lg leading-relaxed">
            Short answers. No fluff. Trust over cleverness.
          </p>
        </div>

        <div className="mt-10">
          <FAQ
            items={[
              {
                q: "Is this accounting software?",
                a: "It’s an operating system for capturing business reality and understanding jobs. You can export what you need for bookkeeping, but ChiefOS is built for day-to-day operational truth.",
              },
              {
                q: "Do my workers need an app?",
                a: "No. The goal is to meet crews where they already are. Ingestion happens through simple channels. The ‘Chief’ reasoning interface stays with the owner/operator.",
              },
              {
                q: "Why not just use QuickBooks?",
                a: "QuickBooks is great for accounting records. ChiefOS focuses on capturing reality as it happens, job-by-job, so you can understand causes — not just totals after the fact.",
              },
              {
                q: "What if I make a mistake?",
                a: "ChiefOS is built to be repairable: confirm steps, allow undo, and keep an audit trail so corrections don’t destroy trust.",
              },
              {
                q: "Does it keep receipt images?",
                a: "Yes — receipts are stored as evidence and are searchable later, so you can always trace numbers back to what actually happened.",
              },
            ]}
          />
        </div>
      </Section>

      <SiteFooter
        brandLine="ChiefOS puts reality into the equation."
        subLine="Capture real work. Understand real jobs."
      />
    </main>
  );
}
