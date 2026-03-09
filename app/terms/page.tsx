// chiefos-site/app/terms/page.tsx
import Link from "next/link";

const LAST_UPDATED = "March 8, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-white/70">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-sm text-white/70">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <main className="space-y-6">

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">

        <div className="text-xs tracking-[0.18em] uppercase text-white/55">
          Legal
        </div>

        <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white/95">
          Terms of Service
        </h1>

        <div className="mt-3 text-sm text-white/60">
          Last updated: {LAST_UPDATED}
        </div>

        <div className="mt-4 text-sm text-white/70">
          These Terms govern your use of ChiefOS (“Service”), including our website,
          portal, and messaging-based features.
        </div>

        <div className="mt-5 flex gap-3">
          <Link
            href="/privacy"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85"
          >
            Privacy Policy
          </Link>
        </div>
      </div>

      <Section title="1. The Service (Beta)">
        <Bullets
          items={[
            <>ChiefOS may be offered as an early access or beta service.</>,
            <>Features may change or be removed as the system evolves.</>,
            <>Outputs should be verified before making business decisions.</>,
          ]}
        />
      </Section>

      <Section title="2. Accounts">
        <Bullets
          items={[
            <>You must provide accurate information.</>,
            <>You are responsible for maintaining account security.</>,
            <>You are responsible for all activity under your account.</>,
          ]}
        />
      </Section>

      <Section title="3. Customer Data">
        <div>
          Users retain ownership of the business records they submit to the Service.
          By using the Service you grant ChiefOS permission to process this data
          solely for the purpose of operating and improving the platform.
        </div>
      </Section>

      <Section title="4. Artificial intelligence features">
        <div>
          ChiefOS may use automated systems to generate insights from submitted
          records.
        </div>

        <div>
          AI-generated outputs may contain errors and should not be considered
          accounting, financial, or legal advice.
        </div>
      </Section>

      <Section title="5. Acceptable use">
        <Bullets
          items={[
            <>Do not use the Service for illegal activity.</>,
            <>Do not attempt unauthorized system access.</>,
            <>Do not interfere with platform reliability.</>,
          ]}
        />
      </Section>

      <Section title="6. Billing">
        <div>
          Paid subscriptions are processed by Stripe. Failure to pay applicable
          fees may result in restricted access.
        </div>
      </Section>

      <Section title="7. Aggregated data">
        <div>
          ChiefOS may generate anonymized or aggregated data derived from system
          activity. This information does not identify individual users and may
          be used internally to improve the platform.
        </div>
      </Section>

      <Section title="8. Limitation of liability">
        <div>
          To the maximum extent permitted by law, ChiefOS will not be liable for
          indirect, incidental, or consequential damages arising from use of the
          Service.
        </div>
      </Section>

      <Section title="9. Governing law">
        <div>
          These Terms are governed by the laws of the jurisdiction in which
          ChiefOS operates.
        </div>
      </Section>

      <Section title="10. Changes to terms">
        <div>
          We may update these Terms periodically. Continued use of the Service
          constitutes acceptance of updated Terms.
        </div>
      </Section>

    </main>
  );
}