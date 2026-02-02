// app/page.tsx (Next.js App Router)
// Homepage layout with image placeholders for future videos
// Adds:
//  - smooth background color transitions between sections (Cash App feel)
//  - mobile sticky bottom CTA bar
//  - hides sticky CTA when bottom CTA section is visible (so you don’t see 2 CTAs)

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Bg = "white" | "blue";

type SectionProps = {
  id: string;
  title: string;
  body: string;
  imageSrc: string;
  bg: Bg;
};

const bgToColor: Record<Bg, string> = {
  white: "#ffffff",
  blue: "#000080", // navy
};

const isDarkBg = (bg: Bg) => bg === "blue";

const CTA_HREF = "/early-access";
const SCARCITY_LINE = "Limited early access — spots open in batches.";

const Section = ({ id, title, body, imageSrc, bg }: SectionProps) => {
  const dark = isDarkBg(bg);

  return (
    <section id={id} data-bg={bg} className="w-full flex justify-center">
      <div className="max-w-md w-full px-4 py-14 space-y-6">
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
          <p className={`text-sm ${dark ? "text-white/80" : "text-black/70"}`}>
            {body}
          </p>
        </div>
      </div>
    </section>
  );
};

export default function HomePage() {
  // Drives the smooth background color cross-fade.
  const [activeBg, setActiveBg] = useState<Bg>("white");

  // Hide the sticky CTA when the bottom CTA section is in view.
  const [hideStickyCta, setHideStickyCta] = useState(false);

  // Requested transitions:
  // - Sections 2 and 3: Blue
  // - Sections 4 and 5: White
  // - Bottom section: Blue
  const sections = useMemo(
    () => [
      { id: "hero", bg: "white" as const },
      { id: "s1", bg: "white" as const },
      { id: "s2", bg: "blue" as const },
      { id: "s3", bg: "blue" as const },
      { id: "s4", bg: "white" as const },
      { id: "s5", bg: "white" as const },
      { id: "trust", bg: "white" as const },
      { id: "cta", bg: "blue" as const },
    ],
    []
  );

  useEffect(() => {
    // 1) Observer to drive background color.
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (!els.length) return;

    const bgObs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (!visible) return;
        const bg = (visible.target as HTMLElement).dataset.bg as Bg | undefined;
        if (!bg) return;

        // Functional update prevents “stuck” background when scrolling back up.
        setActiveBg((prev) => (bg !== prev ? bg : prev));
      },
      {
        root: null,
        threshold: [0.12, 0.25, 0.35, 0.5, 0.65],
        rootMargin: "-45% 0px -45% 0px",
      }
    );

    els.forEach((el) => bgObs.observe(el));

    // 2) Observer to hide sticky CTA when the CTA section is visible.
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
          <div className="max-w-md w-full px-4 py-20 space-y-6">
            <h1 className="text-3xl font-semibold leading-tight text-black">
              Talk to your business.<br />Get answers you can trust.
            </h1>
            <p className="text-base text-black/70">
              ChiefOS turns real-world activity into explainable business understanding.
            </p>
            <p className="text-sm text-black/50">One business. One mind. Many senses.</p>
            <p className="text-sm text-black/60">{SCARCITY_LINE}</p>
          </div>
        </section>

        {/* SECTION 1 (White) */}
        <Section
          id="s1"
          bg="white"
          title="Capture work as it happens"
          body="Send receipts, messages, and time logs — just like you already do."
          imageSrc="/placeholders/receipt-capture.png"
        />

        {/* SECTION 2 (Blue) */}
        <Section
          id="s2"
          bg="blue"
          title="ChiefOS turns activity into records"
          body="Every action becomes a structured, auditable entry — tied to the right job."
          imageSrc="/placeholders/expense-record.png"
        />

        {/* SECTION 3 (Blue) */}
        <Section
          id="s3"
          bg="blue"
          title="Everything attaches to real jobs"
          body="Time, expenses, and revenue stay connected — so answers stay honest."
          imageSrc="/placeholders/job-time.png"
        />

        {/* SECTION 4 (White) */}
        <Section
          id="s4"
          bg="white"
          title="What you log stays visible"
          body="No hidden automation. No silent changes. Every entry has a trail."
          imageSrc="/placeholders/task-list.png"
        />

        {/* SECTION 5 (White) */}
        <Section
          id="s5"
          bg="white"
          title="Ask real questions. Get grounded answers."
          body="Chief answers using only what’s been logged — and tells you what’s missing."
          imageSrc="/placeholders/ask-chief.png"
        />

        {/* TRUST SECTION (White) */}
        <section id="trust" data-bg="white" className="w-full flex justify-center">
          <div className="max-w-md w-full px-4 py-16 space-y-4 text-sm text-black">
            <ul className="space-y-2 text-black/70">
              <li>• One reasoning seat per business</li>
              <li>• Facts in, understanding out</li>
              <li>• No guesses or silent automation</li>
              <li>• Your data only — always</li>
            </ul>
          </div>
        </section>

        {/* CTA SECTION (Blue) */}
        <section id="cta" data-bg="blue" className="w-full flex justify-center">
          <div className="max-w-md w-full px-4 py-16 space-y-4">
            <h2 className="text-xl font-semibold text-white">See what your business actually knows.</h2>
            <a
              href={CTA_HREF}
              className="block w-full rounded-xl bg-white text-black py-3 text-sm font-medium text-center"
            >
              Request early access
            </a>
            <p className="text-xs text-white/70">{SCARCITY_LINE}</p>
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
        <div className="mx-auto max-w-md px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <div className="rounded-2xl bg-white/90 backdrop-blur border border-black/10 shadow-lg">
            <div className="p-3">
              <a
                href={CTA_HREF}
                className="block w-full rounded-xl bg-black text-white py-3 text-sm font-medium text-center"
              >
                Request early access
              </a>
              <p className="mt-2 text-xs text-black/50 text-center">{SCARCITY_LINE}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
