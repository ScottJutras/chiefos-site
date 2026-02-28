// chiefos-site/app/terms/page.tsx
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

export default function TermsPage() {
  return (
    <main className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">
          Legal
        </div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Terms of Service
        </h1>
        <div className="mt-3 text-sm text-white/60">
          Last updated: {LAST_UPDATED}
        </div>

        <div className="mt-4 text-sm text-white/70 leading-relaxed">
          These Terms govern your use of ChiefOS (the “Service”), including our website,
          portal, and messaging-based features (including WhatsApp ingestion). By using the
          Service, you agree to these Terms.
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/privacy"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]"
          >
            Privacy Policy
          </Link>
          <a
            href="mailto:support@usechiefos.com"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]"
          >
            Support: support@usechiefos.com
          </a>
        </div>
      </div>

      <Section title="1) The Service (beta status)">
        <div>
          ChiefOS may be offered as an early access / beta service. That means features
          may change, improve, or be removed as we learn and harden the product.
        </div>
        <Bullets
          items={[
            <>You’re responsible for verifying outputs before making business decisions.</>,
            <>Some features depend on third-party platforms (e.g., WhatsApp/Twilio).</>,
            <>We may introduce limits to protect reliability and prevent abuse.</>,
          ]}
        />
      </Section>

      <Section title="2) Your account and responsibilities">
        <Bullets
          items={[
            <>You must provide accurate information and keep your login secure.</>,
            <>You are responsible for activity under your account.</>,
            <>Do not attempt to access other users’ data or bypass tenant isolation.</>,
          ]}
        />
      </Section>

      <Section title="3) Your content and permissions">
        <div>
          You retain ownership of the content you submit (receipts, logs, messages, files).
          You grant ChiefOS a limited license to host, process, and display that content solely
          to operate and improve the Service.
        </div>
      </Section>

      <Section title="4) Acceptable use">
        <div>You agree not to:</div>
        <Bullets
          items={[
            <>Use the Service for illegal activity or to infringe others’ rights.</>,
            <>Upload malware, attempt exploitation, or probe security vulnerabilities.</>,
            <>Abuse messaging features (spam, harassment, or automated flooding).</>,
            <>Reverse engineer or misuse the Service in a way that harms reliability.</>,
          ]}
        />
      </Section>

      <Section title="5) Billing (if applicable)">
        <div>
          If you subscribe, payments are processed by Stripe. Plans, pricing, and billing periods
          may change with notice. Non-payment may result in restricted access.
        </div>
      </Section>

      <Section title="6) Deletion, reset, and termination">
        <Bullets
          items={[
            <>
              You can reset or delete your account from settings. Reset deletes workspace data while
              keeping your login. Delete removes your account and access.
            </>,
            <>
              We may suspend or terminate accounts that violate these Terms or threaten system integrity.
            </>,
          ]}
        />
      </Section>

      <Section title="7) Disclaimers">
        <div>
          The Service is provided “as is” and “as available.” We do not guarantee that the Service
          will be uninterrupted, error-free, or perfectly accurate—especially in beta.
        </div>
      </Section>

      <Section title="8) Limitation of liability">
        <div>
          To the maximum extent permitted by law, ChiefOS will not be liable for indirect, incidental,
          special, consequential, or punitive damages, or for lost profits, revenues, or data, arising
          from your use of the Service.
        </div>
      </Section>

      <Section title="9) Changes to these Terms">
        <div>
          We may update these Terms. We’ll update the “Last updated” date and may notify you for
          material changes.
        </div>
      </Section>

      <Section title="10) Contact">
        <div>
          Questions about these Terms:{" "}
          <a className="underline text-white/85" href="mailto:support@usechiefos.com">
            support@usechiefos.com
          </a>
          .
        </div>
      </Section>

      <div className="text-xs text-white/45 leading-relaxed">
        This page is provided for operational clarity and product credibility. It is not legal advice.
      </div>
    </main>
  );
}