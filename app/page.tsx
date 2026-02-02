// app/page.tsx (Next.js App Router)
// Homepage layout with image placeholders for future videos

import Image from "next/image";
import React from "react";

type SectionProps = {
  title: string;
  body: string;
  imageSrc: string;
  dark?: boolean;
};

const Section: React.FC<SectionProps> = ({ title, body, imageSrc, dark = false }) => (
  <section className={`w-full flex justify-center ${dark ? "bg-black text-white" : "bg-white text-black"}`}>
    <div className="max-w-md w-full px-4 py-14 space-y-6">
      <div className={`rounded-2xl overflow-hidden shadow-lg ${dark ? "border border-neutral-800" : "border border-neutral-200"}`}>
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
        <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        <p className="text-sm opacity-80">{body}</p>
      </div>
    </div>
  </section>
);

export default function HomePage() {
  return (
    <main className="w-full">
      {/* HERO */}
      <section className="w-full flex justify-center bg-white">
        <div className="max-w-md w-full px-4 py-20 space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Talk to your business.<br />Get answers you can trust.
          </h1>
          <p className="text-base opacity-80">
            ChiefOS turns real-world activity into explainable business understanding.
          </p>
          <p className="text-sm opacity-60">One business. One mind. Many senses.</p>
        </div>
      </section>

      {/* SECTION 1 */}
      <Section
        title="Capture work as it happens"
        body="Send receipts, messages, and time logs — just like you already do."
        imageSrc="/placeholders/receipt-capture.png"
      />

      {/* SECTION 2 */}
      <Section
        title="ChiefOS turns activity into records"
        body="Every action becomes a structured, auditable entry — tied to the right job."
        imageSrc="/placeholders/expense-record.png"
      />

      {/* SECTION 3 */}
      <Section
        title="Everything attaches to real jobs"
        body="Time, expenses, and revenue stay connected — so answers stay honest."
        imageSrc="/placeholders/job-time.png"
        dark
      />

      {/* SECTION 4 */}
      <Section
        title="What you log stays visible"
        body="No hidden automation. No silent changes. Every entry has a trail."
        imageSrc="/placeholders/task-list.png"
      />

      {/* SECTION 5 */}
      <Section
        title="Ask real questions. Get grounded answers."
        body="Chief answers using only what’s been logged — and tells you what’s missing."
        imageSrc="/placeholders/ask-chief.png"
        dark
      />

      {/* TRUST SECTION */}
      <section className="w-full flex justify-center bg-white">
        <div className="max-w-md w-full px-4 py-16 space-y-4 text-sm">
          <ul className="space-y-2 opacity-80">
            <li>• One reasoning seat per business</li>
            <li>• Facts in, understanding out</li>
            <li>• No guesses or silent automation</li>
            <li>• Your data only — always</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full flex justify-center bg-neutral-50 border-t">
        <div className="max-w-md w-full px-4 py-16 space-y-4">
          <h2 className="text-xl font-semibold">See what your business actually knows.</h2>
          <button className="w-full rounded-xl bg-black text-white py-3 text-sm font-medium">
            Join the beta
          </button>
        </div>
      </section>
    </main>
  );
}
