// chiefos-site/app/privacy/page.tsx
import Link from "next/link";

const LAST_UPDATED = "March 8, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-white/70">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="space-y-6">

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">
          Legal
        </div>

        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Privacy Policy
        </h1>

        <div className="mt-3 text-sm text-white/60">
          Last updated: {LAST_UPDATED}
        </div>

        <div className="mt-4 text-sm text-white/70 leading-relaxed">
          This Privacy Policy explains how ChiefOS (“ChiefOS”, “we”, “us”) collects,
          uses, and protects information when you use our website, portal, and
          messaging-based features (including WhatsApp ingestion).
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/terms"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]"
          >
            Terms of Service
          </Link>

          <a
            href="mailto:privacy@usechiefos.com"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]"
          >
            privacy@usechiefos.com
          </a>
        </div>
      </div>

      <Section title="What we collect">
        <Bullets
          items={[
            <>Account information such as email address, authentication identifiers, and phone number if connected through messaging integrations.</>,
            <>Business data submitted to the platform including receipts, invoices, documents, transaction logs, job information, notes, and related metadata.</>,
            <>Usage information such as page views, request timestamps, system activity logs, and security events.</>,
            <>Payment status information if you subscribe to a paid plan. Payments are processed by Stripe and we do not store full card details.</>,
          ]}
        />
      </Section>

      <Section title="How we use information">
        <Bullets
          items={[
            <>Provide and operate the Service.</>,
            <>Organize and process business records submitted by users.</>,
            <>Generate insights and summaries using automated systems.</>,
            <>Maintain platform reliability, security, and performance.</>,
            <>Communicate with users regarding product updates and support requests.</>,
          ]}
        />
      </Section>

      <Section title="Artificial intelligence and automated processing">
        <div>
          ChiefOS uses automated systems and machine learning to analyze submitted
          records and generate insights intended to help users understand business
          activity.
        </div>

        <div>
          These systems may process Customer Data to improve capture accuracy,
          classification, summarization, and insight generation.
        </div>

        <div>
          AI-generated outputs are informational and may contain inaccuracies.
          Users remain responsible for reviewing important financial or operational
          decisions.
        </div>
      </Section>

      <Section title="Aggregated and de-identified data">
        <div>
          ChiefOS may create aggregated, anonymized, or de-identified datasets derived
          from platform activity.
        </div>

        <Bullets
          items={[
            <>These datasets do not identify individual users or businesses.</>,
            <>They cannot reasonably be used to reconstruct customer records.</>,
            <>They may be used internally to improve reliability, develop new features, conduct research, and train machine learning systems.</>,
          ]}
        />
      </Section>

      <Section title="How we share information">
        <div>
          We do not sell personal information. Information may be shared only when
          necessary to operate the Service or comply with legal obligations.
        </div>

        <div className="mt-3 font-semibold text-white/85">Service providers</div>

        <Bullets
          items={[
            <>Supabase – authentication, database, and storage.</>,
            <>Vercel – application hosting and delivery.</>,
            <>Twilio – messaging infrastructure for WhatsApp ingestion.</>,
            <>Stripe – subscription billing and payments.</>,
          ]}
        />
      </Section>

      <Section title="Data retention">
        <Bullets
          items={[
            <>Workspace data is retained while your account is active.</>,
            <>Users may delete or reset their workspace from settings.</>,
            <>Deleted information may persist temporarily in backups (typically 30–90 days).</>,
            <>Aggregated or anonymized data may be retained for research and service improvement.</>,
          ]}
        />
      </Section>

      <Section title="Security">
        <Bullets
          items={[
            <>Encryption in transit (HTTPS) and encrypted infrastructure storage.</>,
            <>Access controls and operational least-privilege practices.</>,
            <>Tenant isolation patterns to prevent cross-workspace access.</>,
            <>Monitoring and logging for reliability and security investigations.</>,
          ]}
        />
      </Section>

      <Section title="Your rights">
        <Bullets
          items={[
            <>Access and update information through account settings.</>,
            <>Request export of your data.</>,
            <>Request deletion of your account.</>,
          ]}
        />
      </Section>

      <Section title="International data transfers">
        <div>
          Our service providers may process data in multiple regions including the
          United States. We take reasonable steps to ensure appropriate protections
          are applied.
        </div>
      </Section>

      <Section title="Changes to this policy">
        <div>
          We may update this Privacy Policy as the Service evolves. Updates will be
          reflected by revising the “Last updated” date above.
        </div>
      </Section>

      <div className="text-xs text-white/45">
        This page is provided for transparency and product clarity. It is not legal advice.
      </div>
    </main>
  );
}