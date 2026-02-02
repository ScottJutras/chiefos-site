// app/page.tsx (Next.js App Router)
// Video-first homepage (placeholders)
// Adds:
//  - smooth background transitions
//  - mobile sticky bottom CTA bar
//  - sticky CTA hides when bottom CTA section is visible
//  - richer typography (multi-line titles/bodies + bold keywords)

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type Bg = "white" | "green";

type SectionProps = {
  id: string;
  title: ReactNode;
  body: ReactNode;
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

function Section({ id, title, body, imageSrc, bg }: SectionProps) {
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
            alt={typeof title === "string" ? title : "Section image"}
            width={390}
            height={780}
            className="w-full h-auto"
            priority
          />
        </div>

        <div className="space-y-3">
          <h2 className={`text-xl font-semibold leading-tight ${dark ? "text-white" : "text-black"}`}>
            {title}
          </h2>

          {/* Render body as rich content */}
          <div className={`text-sm leading-relaxed ${dark ? "text-white/85" : "text-black/70"}`}>
            {body}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [activeBg, setActiveBg] = useState<Bg>("white");
  const [hideStickyCta, setHideStickyCta] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Background transitions map (NO "blue" anywhere — only white/green)
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
      { id: "availability", bg: "white" as const },
      { id: "cta", bg: "green" as const },
    ],
    []
  );

  useEffect(() => {
    // --- Background driver: pick the section under the viewport center ---
    const pickBgFromViewport = () => {
      const x = Math.round(window.innerWidth / 2);
      const y = Math.round(window.innerHeight * 0.52); // slightly below center feels better on mobile

      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return;

      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const bg = node.dataset?.bg as Bg | undefined;
        if (bg) {
          setActiveBg((prev) => (prev !== bg ? bg : prev));
          return;
        }
        node = node.parentElement;
      }
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        pickBgFromViewport();
      });
    };

    pickBgFromViewport();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // --- Hide sticky CTA when bottom CTA section is visible ---
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
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (ctaObs) ctaObs.disconnect();
    };
  }, []);

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
            {/* 2) Force the last line to stay on one line */}
            <h1 className="text-3xl font-semibold leading-tight text-black space-y-1">
              <span className="block">Know your numbers.</span>
              <span className="block">Win more jobs.</span>
              <span className="block">Keep more profit.</span>
              <span className="block text-black/80 mt-2 whitespace-nowrap">
                Without living in spreadsheets.
              </span>
            </h1>

            <p className="text-base text-black/70 text-balance">
              <span className="font-medium text-black">ChiefOS is the operating system for contractor businesses.</span>
            </p>

            {/* 3) Move the example question into the bordered “Chief response” box */}
            <ul className="mt-1 space-y-2 text-base text-black/80 text-balance">
              <li>• Snap receipts</li>
              <li>• Log crew hours</li>
              <li>• Track jobs</li>
              <li>• Ask Chief for real answers — based on what you logged</li>
            </ul>

            <div className="mt-5 rounded-xl border border-black/10 bg-white/70 p-4">
              <p className="text-sm text-black/80 leading-relaxed text-balance">
                <span className="font-medium text-black">You:</span>{" "}
                “Did we make money on Job 15 Main St?”
                <br />
                <br />
                <span className="font-medium text-black">Chief:</span>{" "}
                On Job 15 Main St, your profit margin came in at{" "}
                <span className="font-medium">15%</span>. You quoted materials at{" "}
                <span className="font-medium">$15,542</span>, but actual spend was{" "}
                <span className="font-medium">$19,456.89</span>.
                <br />
                <br />
                You planned for <span className="font-medium">212 labour hours</span>, but logged{" "}
                <span className="font-medium">262.9 hours</span> — about{" "}
                <span className="font-medium">24% higher</span> than expected.
                <br />
                <br />
                You did make money — but on the next renovation job, adjusting labour + material pricing
                could increase profit by ~<span className="font-medium">10%</span>, helping you move toward
                a year-end goal of <span className="font-medium">30%</span> margin.
              </p>
            </div>

            <div className="rounded-xl border border-black/10 bg-white/70 p-4">
              <p className="text-sm text-black/80 text-balance">
                <span className="font-medium">Works where you already communicate:</span> add Chief on WhatsApp and log in seconds.
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
          body={
            <>Receipts, payments, crew hours, quick notes — send it to Chief in WhatsApp while you’re on site. No app-hopping. No “I’ll do it later.”</>
          }
          imageSrc="/placeholders/receipt-capture.png"
        />

        {/* 4) SECTION 2 title: force two lines */}
        <Section
          id="s2"
          bg="green"
          title={
            <>
              <span className="block">Expenses, handled.</span>
              <span className="block">Just Snap → Confirm → Done.</span>
            </>
          }
          body={
            <>
              Send a receipt photo, voice note, or text. Chief pulls out the vendor, amount, date, and job.
              You tap confirm, and it’s logged.
              <br />
              <br />
              Year-end? Download a spreadsheet, send it to your accountant — then go enjoy your life.
            </>
          }
          imageSrc="/placeholders/expense-record.png"
        />

        {/* 5) Background switching fixed by “viewport center” method above */}
        <Section
          id="s3"
          bg="green"
          title="Crew hours that don’t get lost (or “rounded”)."
          body={
            <>
              Clock-ins, breaks, lunch, drive time — live or as a once-a-day/week dump.
              <br />
              <br />
              Chief helps you spot labour leakage like: “This job is running 18% over labour vs your average — here’s where the extra time is coming from.”
            </>
          }
          imageSrc="/placeholders/job-time.png"
        />

        {/* 6) SECTION 4 copy with its own line */}
        <Section
          id="s4"
          bg="white"
          title="Every log ties to a job — so you know EXACTLY where you’re profitable (and where you aren’t)."
          body={
            <>
              Track each job’s real costs: receipts + labour + revenue. Compare jobs, see what’s slipping, and price the next quote with confidence.
              <span className="block mt-2 font-medium text-black">No guessing.</span>
            </>
          }
          imageSrc="/placeholders/task-list.png"
        />

        {/* 7) SECTION 5 body as stacked lines + questions */}
        <Section
          id="s5"
          bg="white"
          title="Ask Chief. Get answers grounded in your real data."
          body={
            <div className="space-y-2">
              <p className="text-black/70">Most apps just store data.</p>
              <p className="text-black/70">
                <span className="font-medium text-black">ChiefOS understands your data.</span>
              </p>

              <div className="mt-2 space-y-1">
                <p className="text-black/70">
                  You ask: <span className="font-medium text-black">Are we profitable?</span>
                </p>
                <p className="text-black/70">
                  <span className="font-medium text-black">What did that rework cost?</span>
                </p>
                <p className="text-black/70">
                  <span className="font-medium text-black">What should I charge on this quote?</span>
                </p>
              </div>

              <p className="text-black/70">
                Chief answers based on what you’ve logged.
                <span className="font-medium text-black"> No guessing. Only truth from your data.</span>
              </p>
            </div>
          }
          imageSrc="/placeholders/ask-chief.png"
        />

        {/* 8) SECTION 6: bold keywords + conversational examples */}
        <Section
          id="s6"
          bg="green"
          title={
            <>
              <span className="block">Coming next:</span>
              <span className="block">
                Job Flow: <span className="font-semibold">Quote</span> → <span className="font-semibold">Sign</span> →{" "}
                <span className="font-semibold">Contract</span> → <span className="font-semibold">Change Order</span> →{" "}
                <span className="font-semibold">Invoice</span> → <span className="font-semibold">Receipt</span>{" "}
                <span className="text-white/80">(Spring ’26)</span>
              </span>
            </>
          }
          body={
            <div className="space-y-3">
              <p>
                We’re rolling out a feature that lets you create and control your job flow conversationally:
              </p>

              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Quote:</span> “Chief, send a renovation quote for $45,000 to John &amp; Mary for 100 Main St.”
                </p>
                <p>
                  <span className="font-semibold">Contract:</span> “Chief, they accepted — send a contract to 100 Main St for signature.”
                </p>
                <p>
                  <span className="font-semibold">Change Order:</span> “Chief, send a change order to 100 Main St for kitchen reframing — $1,500 — for approval.”
                </p>
                <p>
                  <span className="font-semibold">Invoice:</span> “Chief, 100 Main St is done — send the final invoice.”
                </p>
                <p>
                  <span className="font-semibold">Receipt:</span> “Chief, we got paid — send the receipt and ask for a review.”
                </p>
              </div>
            </div>
          }
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

        {/* 1) Move “Now available on WhatsApp” here, in black */}
        <section id="availability" data-bg="white" className="w-full flex justify-center">
          <div className="max-w-lg w-full px-4 pb-8">
            <p className="text-xs font-medium tracking-wide text-black text-center">
              Now available on WhatsApp
            </p>
          </div>
        </section>

        {/* CTA SECTION (Green) */}
        <section id="cta" data-bg="green" className="w-full flex justify-center">
          <div className="max-w-lg w-full px-4 py-16 space-y-4">
            <h2 className="text-xl font-semibold text-white text-balance">
              Get early access to the fastest way to run a profitable contracting business.
            </h2>

            <a
              href={CTA_HREF}
              className="inline-flex items-center justify-center w-full rounded-xl bg-white text-black py-3 text-sm font-medium text-center shadow-md active:scale-[0.98] transition"
            >
              Request early access
            </a>

            <p className="text-xs text-white/85">{SCARCITY_LINE}</p>
          </div>
        </section>

        {/* Spacer so the sticky bar doesn’t cover bottom content on mobile */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Sticky Bottom CTA (mobile only) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-all duration-300 ease-out ${
          hideStickyCta ? "opacity-0 pointer-events-none translate-y-3" : "opacity-100 translate-y-0"
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
              <p className="mt-2 text-xs text-black/60 text-center">{SCARCITY_LINE}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
