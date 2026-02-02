// app/page.tsx (Next.js App Router)
// Homepage layout with image placeholders for future videos
// Adds:
//  - smooth background color transitions between sections (Cash App feel)
//  - mobile sticky bottom CTA bar

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type SectionProps = {
  id: string;
  title: string;
  body: string;
  imageSrc: string;
  dark?: boolean;
  // background token used for smooth cross-fade
  bg: "white" | "black" | "neutral";
};

const bgToClass: Record<SectionProps["bg"], string> = {
  white: "bg-white",
  black: "bg-black",
  neutral: "bg-neutral-50",
};

const Section = ({ id, title, body, imageSrc, dark = false, bg }: SectionProps) => (
  <section
    id={id}
    data-bg={bg}
    className="w-full flex justify-center"
  >
    <div className="max-w-md w-full px-4 py-14 space-y-6">
      <div
        className={`rounded-2xl overflow-hidden shadow-lg ${
          dark ? "border border-neutral-800" : "border border-neutral-200"
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
        <h2 className={`text-xl font-semibold leading-tight ${dark ? "text-white" : "text-black"}`}>{title}</h2>
        <p className={`text-sm ${dark ? "text-white/80" : "text-black/70"}`}>{body}</p>
      </div>
    </div>
  </section>
);

export default function HomePage() {
  // This drives the smooth background color cross-fade.
  const [activeBg, setActiveBg] = useState<SectionProps["bg"]>("white");

  const sections = useMemo(
    () => [
      { id: "hero", bg: "white" as const },
      { id: "s1", bg: "white" as const },
      { id: "s2", bg: "white" as const },
      { id: "s3", bg: "black" as const },
      { id: "s4", bg: "white" as const },
      { id: "s5", bg: "black" as const },
      { id: "trust", bg: "white" as const },
      { id: "cta", bg: "neutral" as const },
    ],
    []
  );

  useEffect(() => {
    // Observe sections and set the active background based on what's near the middle of the viewport.
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the most visible intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (!visible) return;
        const bg = (visible.target as HTMLElement).dataset.bg as SectionProps["bg"] | undefined;
        if (bg && bg !== activeBg) setActiveBg(bg);
      },
      {
        // This makes the “active section” feel like it changes as you scroll past the midline.
        root: null,
        threshold: [0.15, 0.25, 0.35, 0.5, 0.65],
        rootMargin: "-45% 0px -45% 0px",
      }
    );

    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  return (
    <main className="relative w-full">
      {/* Smooth, full-page background layer */}
      <div
        aria-hidden
        className={`fixed inset-0 -z-10 transition-colors duration-700 ease-out ${bgToClass[activeBg]}`}
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
          </div>
        </section>

        {/* SECTION 1 */}
        <Section
          id="s1"
          bg="white"
          title="Capture work as it happens"
          body="Send receipts, messages, and time logs — just like you already do."
          imageSrc="/placeholders/receipt-capture.png"
        />

        {/* SECTION 2 */}
        <Section
          id="s2"
          bg="white"
          title="ChiefOS turns activity into records"
          body="Every action becomes a structured, auditable entry — tied to the right job."
          imageSrc="/placeholders/expense-record.png"
        />

        {/* SECTION 3 */}
        <Section
          id="s3"
          bg="black"
          dark
          title="Everything attaches to real jobs"
          body="Time, expenses, and revenue stay connected — so answers stay honest."
          imageSrc="/placeholders/job-time.png"
        />

        {/* SECTION 4 */}
        <Section
          id="s4"
          bg="white"
          title="What you log stays visible"
          body="No hidden automation. No silent changes. Every entry has a trail."
          imageSrc="/placeholders/task-list.png"
        />

        {/* SECTION 5 */}
        <Section
          id="s5"
          bg="black"
          dark
          title="Ask real questions. Get grounded answers."
          body="Chief answers using only what’s been logged — and tells you what’s missing."
          imageSrc="/placeholders/ask-chief.png"
        />

        {/* TRUST SECTION */}
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

        {/* CTA (non-sticky section, still useful for desktop) */}
        <section id="cta" data-bg="neutral" className="w-full flex justify-center border-t border-black/10">
          <div className="max-w-md w-full px-4 py-16 space-y-4">
            <h2 className="text-xl font-semibold text-black">See what your business actually knows.</h2>
            <button className="w-full rounded-xl bg-black text-white py-3 text-sm font-medium">
              Join the beta
            </button>
          </div>
        </section>

        {/* spacer so the sticky bar doesn’t cover bottom content on mobile */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Sticky Bottom CTA (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="mx-auto max-w-md px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <div className="rounded-2xl bg-white/90 backdrop-blur border border-black/10 shadow-lg">
            <div className="p-3">
              <button className="w-full rounded-xl bg-black text-white py-3 text-sm font-medium">
                Join the beta
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
