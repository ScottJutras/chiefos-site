import Link from "next/link";

const LAST_UPDATED = "March 8, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <div className="mt-3 text-sm text-white/70 space-y-3 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function AIUsagePolicyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
<div className="mx-auto max-w-5xl px-6 py-16 md:py-20 space-y-6"></div>
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">

        <div className="text-xs tracking-[0.18em] uppercase text-white/55">
          Legal
        </div>

        <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white/95">
          AI Usage Policy
        </h1>

        <div className="mt-3 text-sm text-white/60">
          Last updated: {LAST_UPDATED}
        </div>

        <div className="mt-4 text-sm text-white/70">
          This policy explains how ChiefOS uses artificial intelligence
          systems within the Service.
        </div>

      </div>

      <Section title="Purpose of AI systems">
        <div>
          ChiefOS uses machine learning and automated systems to help
          interpret business records submitted by users and generate
          operational insights.
        </div>
      </Section>

      <Section title="How AI is used">
        <ul className="list-disc pl-5 space-y-2">
          <li>categorizing submitted receipts and records</li>
          <li>generating summaries of business activity</li>
          <li>identifying patterns across submitted transactions</li>
          <li>helping users ask questions about their business data</li>
        </ul>
      </Section>

      <Section title="Limitations">
        <div>
          AI-generated outputs may contain inaccuracies or incomplete
          interpretations of submitted records.
        </div>

        <div>
          Users are responsible for verifying important financial,
          accounting, or operational decisions.
        </div>
      </Section>

      <Section title="Training and system improvement">
        <div>
          ChiefOS may use aggregated or anonymized datasets derived from
          platform activity to improve machine learning systems.
        </div>

        <div>
          These datasets are designed to remove information that identifies
          specific users or businesses.
        </div>
      </Section>

      <Section title="User responsibility">
        <div>
          The Service is intended to assist business owners but does not
          replace professional accounting, legal, or financial advice.
        </div>
      </Section>

      <Section title="Transparency">
        <div>
          We aim to provide clear explanations of how automated systems
          influence outputs generated within the platform.
        </div>
      </Section>

    </main>
  );
}