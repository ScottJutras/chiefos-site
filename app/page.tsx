// app/page.tsx (Next.js App Router)
// Homepage layout with image placeholders for future videos
// Adds:
//  - smooth background color transitions between sections
//  - mobile sticky bottom CTA bar
//  - hides sticky CTA when bottom CTA section is visible (so you don’t see 2 CTAs)

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Bg = "white" | "green";

type SectionProps = {
  id: string;
  title: string;
  body: string;
  imageSrc: string;
  bg: Bg;
};

const bgToColor: Record<Bg, string> = {
  white: "#ffffff",
  green: "#2E6F40",
};

const isDarkBg = (bg: Bg) => bg === "green";

const CTA_HREF = "/early-access";
const SCARCITY_LINE = "Limited early access — spots open in batches.";

const Section = ({ id, title, body, imageSrc, bg }: SectionProps) => {
  const dark = isDarkBg(bg);

  return (
    <section id={id} data-bg={bg} className="w-full flex justify-center">
      <div className="max-w-lg w-full px-4 py-14 space-y-6">
        <div
          className={`rounded-2xl overflow-hidden shadow-lg ${
            dark ? "border border-white/15" : "border border-black/10"
          }`}
        >
          <Image
            src={imageSrc}
            alt={title}
            width={390}
            height={780}
            className="w-full h-auto"
            priority
          />
        </div>

        <div className="space-y-2">
          <h2
            className={`text-xl font-semibold leading-tight ${
              dark ? "text-white" : "text-black"
            }`}
          >
            {title}
          </h2>
          <p
            className={`text-sm leading-relaxed ${
              dark ? "text-white/80" : "text-black/70"
            }`}
          >
            {body}
          </p>
        </div>
      </div>
    </section>
  );
};

export default function HomePage() {
  const [activeBg, setActiveBg] = useState<Bg>("white");
  const [hideStickyCta, setHideStickyCta] = useState(false);

  // Background transitions (green sections are where you want that “flow”)
  const sections = useMemo(
    () => [
      { id: "hero", bg: "white" as const },
      { id: "s1", bg: "white" as const },

      { id: "s2", bg: "green" as const },
      { id: "s3", bg: "green" as const },

      { id: "s4", bg: "white" as const },
      { id: "s5", bg: "white" as const },

      { id: "s6", bg: "green" as const },
      { id: "trust", bg: "white" as const },

      { id: "cta", bg: "green" as const },
    ],
    []
  );

  useEffect(() => {
    // 1) Observer to drive background color
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (!els.length) return;

    const bgObs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0)
          )[0];

        if (!visible) return;

        const bg = (visible.target as HTMLElement).dataset.bg as Bg | undefined;
        if (!bg) return;

        setActiveBg((prev) => (bg !== prev ? bg : prev));
      },
      {
        root: null,
        threshold: [0.12, 0.25, 0.35, 0.5, 0.65],
        rootMargin: "-45% 0px -45% 0px",
      }
    );

    els.forEach((el) => bgObs.observe(el));

    // 2) Observer to hide sticky CTA when the CTA section is visible
    const ctaEl = document.getElementById("cta");
    const ctaObs = ctaEl
      ? new IntersectionObserver(
          (entries) => {
            const ent = entries[0];
            if (!ent) return;
            setHideStickyCta(ent.isIntersecting && ent.intersectionRatio >= 0.25);
          },
          { root: null, threshold: [0, 0.1, 0.25, 0.4, 0.6, 0.8] }
        )
      : null;

    if (ctaEl && ctaObs) ctaObs.observe(ctaEl);

    return () => {
      bgObs.disconnect();
      if (ctaObs) ctaObs.disconnect();
    };
  }, [sections]);

  return (
    <main className="relative w-full">
      {/* Smooth, full-page background layer */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 transition-[background-color] duration-700 ease-out"
        style={{ backgroundColor: bgToColor[activeBg] }}
      />

      {/* Content */}
      <div className="w-full">
        {/* HERO */}
        <section id="hero" data-bg="white" className="w-full flex justify-center">
          <div className="max-w-lg w-full px-4 py-20 space-y-5">
            <p className="text-xs font-medium tracking-wide text-black/60">
              Now available on WhatsApp
            </p>

            {/* Hype (grounded) */}
            <h1 className="text-3xl font-semibold leading-tight text-black space-y-1">
              <span className="block">Know your numbers.</span>
              <span className="block">Win more jobs.</span>
              <span className="block">Keep more profit.</span>
              <span className="block text-black/80 mt-2">
                Without living in spreadsheets.
              </span>
            </h1>

            <p className="text-base text-black/70 text-balance">
              <span className="font-medium text-black">
                ChiefOS is the operating system for contractor businesses.
              </span>{" "}
              Built to keep you out of admin mode and in control of your margins.
            </p>

            <ul className="mt-3 space-y-2 text-base text-black/80 text-balance">
              <li>• Snap receipts</li>
              <li>• Log crew hours</li>
              <li>• Track jobs</li>
              <li>
                • Ask Chief questions like:{" "}
                <span className="text-black font-medium">
                  “Did we make money on Job 15 Main St?”
                </span>
              </li>
            </ul>

            <div className="mt-5 rounded-xl border border-black/10 bg-white/70 p-4">
              <p className="text-sm text-black/80 leading-relaxed text-balance">
                <span className="font-medium text-black">Chief:</span>{" "}
                On Job 15 Main St, your profit margin came in at{" "}
                <span className="font-medium">15%</span>. You quoted materials at{" "}
                <span className="font-medium">$15,542</span>, but actual spend was{" "}
                <span className="font-medium">$19,456.89</span>.
                <br />
                <br />
                You planned for{" "}
                <span className="font-medium">212 labour hours</span>, but logged{" "}
                <span className="font-medium">262.9 hours</span> — about{" "}
                <span className="font-medium">24% higher</span> than expected.
                <br />
                <br />
                You did make money — but on the next renovation job, adjusting labour and
                material pricing could increase profit by ~{" "}
                <span className="font-medium">10%</span>, helping you move toward your year-end
                goal of <span className="font-medium">30%</span> margin.
              </p>
            </div>

            <div className="rounded-xl border border-black/10 bg-white/70 p-4">
              <p className="text-sm text-black/80 text-balance">
                <span className="font-medium">Works where you already communicate:</span>{" "}
                add Chief as a contact on WhatsApp and start logging in seconds.
              </p>
            </div>

            <p className="text-sm text-black/60">{SCARCITY_LINE}</p>
          </div>
        </section>

        {/* SECTION 1 (White) */}
        <Section
          id="s1"
          bg="white"
          title="Log your business in real life. Not after hours."
          body="Receipts, payments, crew hours, quick notes. Send it to Chief in WhatsApp while you’re on site. No app-hopping. No “I’ll do it later.”"
          imageSrc="/placeholders/receipt-capture.png"
        />

        {/* SECTION 2 (Green) */}
        <Section
          id="s2"
          bg="green"
          title="Expenses, handled. Just snap → confirm → done."
          body="Send a receipt photo, voice note, or text. Chief pulls out the vendor, amount, date, and job. You tap confirm, and it’s logged. Year-end? Download a spreadsheet and send it to your accountant — then go enjoy your life."
          imageSrc="/placeholders/expense-record.png"
        />

        {/* SECTION 3 (Green) */}
        <Section
          id="s3"
          bg="green"
          title="Crew hours that don’t get lost (or “rounded”)."
          body="Clock-ins, breaks, lunch, drive time — live or as a once-a-day/week dump. Chief helps you spot labour leakage like: “This job is running 18% over labour vs your average — here’s where the extra time is coming from.”"
          imageSrc="/placeholders/job-time.png"
        />

        {/* SECTION 4 (White) */}
        <Section
          id="s4"
          bg="white"
          title="Every log ties to a job — so profit isn’t a guess."
          body="Track each job’s real costs: receipts + labour + revenue. Compare jobs, see what’s slipping, and price the next quote with confidence instead of gut feel."
          imageSrc="/placeholders/task-list.png"
        />

        {/* SECTION 5 (White) */}
        <Section
          id="s5"
          bg="white"
          title="Ask Chief. Get answers grounded in your real data."
          body="Most apps just store info. ChiefOS understands it. Ask: “Are we profitable?”, “What did that rework cost?”, “What should I charge next time?” Chief answers based on what you’ve logged — and tells you what’s missing."
          imageSrc="/placeholders/ask-chief.png"
        />

        {/* SECTION 6 (Green) */}
        <Section
          id="s6"
          bg="green"
          title="Coming next: quotes → contracts → invoices (Spring 2026)."
          body="We’re rolling out quoting and job paperwork so you can go from ‘quote sent’ to ‘paid’ without duct-taping multiple tools together. Early access gets you in the loop as we release each module."
          imageSrc="/placeholders/roadmap.png"
        />

        {/* TRUST SECTION (White) */}
        <section id="trust" data-bg="white" className="w-full flex justify-center">
          <div className="max-w-lg w-full px-4 py-16 space-y-4 text-sm text-black text-center">
            <ul className="space-y-3 text-black/70 text-balance">
              <li>Built for contractors who want to run lean and stay profitable</li>
              <li>Log in seconds from WhatsApp — no desktop, no office days, no late admin nights</li>
              <li>Job-level visibility so you price smarter and stop throwing away money</li>
              <li>Year-end export in one click — send to your accountant and move on</li>
            </ul>
          </div>
        </section>

        {/* CTA SECTION (Green) */}
        <section id="cta" data-bg="green" className="w-full flex justify-center">
          <div className="max-w-lg w-full px-4 py-16 space-y-4">
            <h2 className="text-xl font-semibold text-white">
              Get early access to the fastest way to run a profitable contracting business.
            </h2>

            <a
              href={CTA_HREF}
              className="inline-flex items-center justify-center w-full rounded-xl bg-white text-black py-3 text-sm font-medium text-center shadow-md active:scale-[0.98] transition"
            >
              Request early access
            </a>

            <p className="text-xs text-white/80">{SCARCITY_LINE}</p>
          </div>
        </section>

        {/* Spacer so the sticky bar doesn’t cover bottom content on mobile */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Sticky Bottom CTA (mobile only) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-all duration-300 ease-out ${
          hideStickyCta
            ? "opacity-0 pointer-events-none translate-y-3"
            : "opacity-100 translate-y-0"
        }`}
      >
        <div className="mx-auto max-w-lg px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <div className="rounded-2xl bg-white/90 backdrop-blur border border-black/10 shadow-lg">
            <div className="p-3">
              <a
                href={CTA_HREF}
                className="inline-flex items-center justify-center w-full rounded-xl bg-black text-white py-3 text-sm font-medium text-center shadow-md active:scale-[0.98] transition"
              >
                Request early access
              </a>
              <p className="mt-2 text-xs text-black/60 text-center">
                {SCARCITY_LINE}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
