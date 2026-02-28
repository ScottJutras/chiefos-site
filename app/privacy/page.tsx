// chiefos-site/app/privacy/page.tsx
import Link from "next/link";

const LAST_UPDATED = "February 27, 2026";

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
        <li key={i} className="leading-relaxed">
          {x}
        </li>
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
          uses, and protects your information when you use our website, portal,
          and messaging-based features (including WhatsApp ingestion).
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
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
            Contact: privacy@usechiefos.com
          </a>
        </div>
      </div>

      <Section title="What we collect">
        <div>
          We collect information you provide directly, information generated through
          your use of ChiefOS, and limited technical information required to operate
          and secure the service.
        </div>

        <Bullets
          items={[
            <>
              <span className="font-semibold text-white/85">Account & identity:</span>{" "}
              email address, authentication identifiers, and (if you connect WhatsApp)
              your phone number.
            </>,
            <>
              <span className="font-semibold text-white/85">Business activity you submit:</span>{" "}
              receipts, invoices, photos/PDFs, messages, transaction logs (expense/revenue/time),
              job references, notes, and related metadata.
            </>,
            <>
              <span className="font-semibold text-white/85">Usage & device data:</span>{" "}
              basic logs such as request timestamps, pages/actions taken, error logs, and
              security events (e.g., suspicious login activity).
            </>,
            <>
              <span className="font-semibold text-white/85">Payment data:</span>{" "}
              if you subscribe, billing is processed by Stripe. We receive billing status and
              identifiers, but we do not store full card details.
            </>,
          ]}
        />
      </Section>

      <Section title="How we use your information">
        <Bullets
          items={[
            <>Provide the service (capture, organize, and display your records; answer your questions).</>,
            <>Operate and secure accounts (authentication, abuse prevention, auditability).</>,
            <>Improve reliability and performance (bug fixes, monitoring, analytics at a service level).</>,
            <>Communicate with you (support responses, product updates you request).</>,
            <>Billing and subscription management (through Stripe).</>,
          ]}
        />
      </Section>

      <Section title="How we share information">
        <div>
          We do not sell your personal information. We share information only as needed
          to run ChiefOS, comply with law, or protect rights and safety.
        </div>

        <div className="mt-3 font-semibold text-white/85">Subprocessors (service providers)</div>
        <Bullets
          items={[
            <>
              <span className="font-semibold text-white/85">Supabase</span> – authentication,
              database, and storage.
            </>,
            <>
              <span className="font-semibold text-white/85">Vercel</span> – hosting and delivery
              of the website and APIs.
            </>,
            <>
              <span className="font-semibold text-white/85">Twilio</span> – WhatsApp messaging
              transport and media retrieval during ingestion.
            </>,
            <>
              <span className="font-semibold text-white/85">Stripe</span> – billing and
              subscription payments.
            </>,
          ]}
        />

        <div className="mt-3">
          We may also share information if required by law, subpoena, or to prevent fraud,
          abuse, or security incidents.
        </div>
      </Section>

      <Section title="Data retention">
        <div>
          We keep your information for as long as you maintain an account and as needed
          to provide the service.
        </div>
        <Bullets
          items={[
            <>
              <span className="font-semibold text-white/85">Workspace data:</span>{" "}
              you can reset or delete your workspace from settings. Deletions are processed
              promptly, and we aim to remove deleted data from active systems quickly.
            </>,
            <>
              <span className="font-semibold text-white/85">Backups:</span>{" "}
              deleted data may persist in backups for a limited period (typically up to 30–90 days),
              then is overwritten or removed in the normal backup cycle.
            </>,
            <>
              <span className="font-semibold text-white/85">Billing records:</span>{" "}
              subscription and invoice records may be retained longer where required for accounting
              and legal compliance.
            </>,
          ]}
        />
      </Section>

      <Section title="Security">
        <div>
          We use reasonable administrative, technical, and organizational measures designed to
          protect your data.
        </div>
        <Bullets
          items={[
            <>Encryption in transit (HTTPS) and encryption at rest via our infrastructure providers.</>,
            <>Access controls and least-privilege for operational access.</>,
            <>Tenant isolation patterns to prevent cross-tenant access.</>,
            <>Monitoring and logging for reliability and security investigations.</>,
          ]}
        />
        <div className="mt-3">
          No system is perfectly secure. If you believe you’ve found a vulnerability, email{" "}
          <a className="underline text-white/85" href="mailto:security@usechiefos.com">
            security@usechiefos.com
          </a>.
        </div>
      </Section>

      <Section title="Your choices & rights">
        <Bullets
          items={[
            <>Access and update certain information through your account settings.</>,
            <>Request deletion of your account and workspace data.</>,
            <>Request help exporting your data (we’ll support reasonable export requests).</>,
          ]}
        />
        <div className="mt-3">
          To request help with data access/export/deletion, contact{" "}
          <a className="underline text-white/85" href="mailto:privacy@usechiefos.com">
            privacy@usechiefos.com
          </a>.
        </div>
      </Section>

      <Section title="Cookies">
        <div>
          We use essential cookies and similar technologies primarily to maintain login sessions,
          secure the service, and prevent abuse. If we add non-essential analytics cookies,
          we’ll update this policy.
        </div>
      </Section>

      <Section title="International data transfers">
        <div>
          Our service providers may process data in different regions (including the United States).
          We take steps designed to ensure appropriate protections are in place when data is transferred.
        </div>
      </Section>

      <Section title="Children’s privacy">
        <div>
          ChiefOS is not intended for children under 16. If you believe a child has provided us
          personal information, contact us and we will take appropriate steps to delete it.
        </div>
      </Section>

      <Section title="Changes to this policy">
        <div>
          We may update this policy to reflect improvements, legal requirements, or product changes.
          We’ll update the “Last updated” date above and may notify you in-product for material changes.
        </div>
      </Section>

      <div className="text-xs text-white/45 leading-relaxed">
        This page is provided for transparency and product credibility. It is not legal advice.
      </div>
    </main>
  );
}