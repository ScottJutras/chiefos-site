import Link from "next/link";

const LAST_UPDATED = "April 5, 2026";
const COMPANY = "9839429 Canada Inc. (operating as ChiefOS)";
const JURISDICTION = "Ontario, Canada";
const SUPPORT_EMAIL = "support@usechiefos.com";
const LEGAL_EMAIL = "legal@usechiefos.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-white/70 leading-relaxed">{children}</div>
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
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20 space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="text-xs tracking-[0.18em] uppercase text-white/55">Legal</div>

          <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white/95">
            Terms of Service
          </h1>

          <div className="mt-3 text-sm text-white/60">Last updated: {LAST_UPDATED}</div>

          <div className="mt-4 text-sm text-white/70 leading-relaxed">
            These Terms of Service ("Terms") govern your access to and use of the ChiefOS platform,
            including our website, web portal, and messaging-based features (collectively, the "Service"),
            operated by {COMPANY}. By creating an account or using the Service, you agree to these Terms.
            If you are using the Service on behalf of a business, you represent that you have authority to
            bind that business to these Terms.
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/privacy" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]">
              Privacy Policy
            </Link>
            <Link href="/legal/ai-policy" className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]">
              AI Policy
            </Link>
            <a href={`mailto:${LEGAL_EMAIL}`} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white/85 hover:bg-white/[0.09]">
              {LEGAL_EMAIL}
            </a>
          </div>
        </div>

        <Section title="1. The Service">
          <Bullets
            items={[
              <>ChiefOS is an AI-assisted business operations platform designed for contractors and small businesses. It provides tools for logging expenses, revenue, time, tasks, jobs, and related business records.</>,
              <>The Service may be offered as an early access or beta product. Features may change, be added, or be removed as the platform evolves.</>,
              <>We do not guarantee uninterrupted availability. Planned maintenance and unexpected downtime may occur.</>,
              <>AI-generated outputs are informational only. You are responsible for verifying any output before using it to make financial, legal, or operational decisions.</>,
            ]}
          />
        </Section>

        <Section title="2. Accounts">
          <Bullets
            items={[
              <>You must provide accurate and complete information when creating an account and keep it up to date.</>,
              <>You are responsible for maintaining the security of your credentials. Do not share your password or account access.</>,
              <>You are responsible for all activity that occurs under your account, whether or not you authorized it.</>,
              <>You must be at least 18 years of age (or the age of majority in your jurisdiction) to use the Service commercially.</>,
              <>One account represents one business workspace. Sharing accounts across multiple unrelated businesses is not permitted.</>,
            ]}
          />
        </Section>

        <Section title="3. Customer data">
          <div>
            You retain ownership of all business records, documents, and data you submit to the Service
            ("Customer Data"). By using the Service, you grant ChiefOS a limited, non-exclusive licence to
            store, process, and analyze your Customer Data solely as necessary to provide and improve the Service.
          </div>
          <div>
            We do not sell your Customer Data. We do not use individually identifiable Customer Data to
            train third-party AI models without your consent.
          </div>
          <div>
            You are responsible for ensuring that any data you submit does not violate the rights of
            third parties or applicable law.
          </div>
        </Section>

        <Section title="4. Artificial intelligence features">
          <div>
            ChiefOS uses automated systems and AI models to process submitted records, generate summaries,
            categorize transactions, and answer questions about your business data.
          </div>
          <div>
            AI-generated outputs may contain errors, omissions, or incomplete interpretations. They do not
            constitute accounting, financial, tax, or legal advice. Always verify important figures with a
            qualified professional.
          </div>
          <div>
            You acknowledge that AI systems may occasionally misclassify records or produce unexpected results.
            We are not liable for decisions made based on AI-generated content.
          </div>
        </Section>

        <Section title="5. Acceptable use">
          <div>You agree not to:</div>
          <Bullets
            items={[
              <>Use the Service for any illegal activity or in violation of applicable laws or regulations.</>,
              <>Submit content that is fraudulent, misleading, or violates the rights of third parties.</>,
              <>Attempt to access, interfere with, or disrupt the platform's systems, infrastructure, or other users' data.</>,
              <>Reverse-engineer, decompile, or attempt to extract source code from the Service.</>,
              <>Resell, sublicence, or provide access to the Service to third parties without our written consent.</>,
              <>Use the Service to build a competing product or to benchmark the Service against competitors without consent.</>,
              <>Introduce malware, viruses, or other harmful code into the Service.</>,
            ]}
          />
          <div>
            Violation of these rules may result in immediate suspension or termination of your account.
          </div>
        </Section>

        <Section title="6. Subscriptions and billing">
          <div>
            ChiefOS offers free and paid subscription plans. Paid plans are billed in advance on a monthly
            or annual basis. All amounts are in Canadian dollars unless stated otherwise.
          </div>
          <div className="font-semibold text-white/85 mt-2">Billing cycles</div>
          <Bullets
            items={[
              <>Monthly plans are billed on the same date each month.</>,
              <>Annual plans are billed once per year at the start of each billing period.</>,
              <>Payments are processed by Stripe. We do not store full card details.</>,
              <>Subscription fees are non-refundable except as stated in Section 7.</>,
            ]}
          />
          <div className="font-semibold text-white/85 mt-2">Price changes</div>
          <div>
            We may change subscription prices with at least 30 days' written notice. Continued use of a
            paid plan after a price change takes effect constitutes acceptance of the new price.
          </div>
          <div className="font-semibold text-white/85 mt-2">Failed payments</div>
          <div>
            If a payment fails, we will attempt to retry the charge. Access to paid features may be
            suspended if payment remains unsuccessful after 7 days. You will be notified before suspension occurs.
          </div>
        </Section>

        <Section title="7. Cancellation and refunds">
          <div className="font-semibold text-white/85">Cancellation</div>
          <Bullets
            items={[
              <>You may cancel your subscription at any time from your account settings or by contacting {SUPPORT_EMAIL}.</>,
              <>Monthly plans: cancellation takes effect at the end of the current billing period. You will not be charged for the next period.</>,
              <>Annual plans: cancellation takes effect at the end of the current annual period. No pro-rated refunds are issued for unused months unless the 14-day refund window applies (see below).</>,
              <>Downgrading to a free plan is treated as a cancellation of your paid subscription.</>,
            ]}
          />
          <div className="font-semibold text-white/85 mt-3">Refunds</div>
          <Bullets
            items={[
              <>New subscribers on any paid plan may request a full refund within 14 days of their first payment if they are not satisfied. Contact {SUPPORT_EMAIL} with your account email and reason.</>,
              <>Annual plan renewals: you may request a full refund within 14 days of the renewal charge if you have not substantially used the Service during that period.</>,
              <>Monthly plan charges are non-refundable after the 14-day window for new subscribers.</>,
              <>Refunds will be issued to the original payment method within 5–10 business days.</>,
              <>ChiefOS reserves the right to deny refund requests that appear to abuse this policy (e.g., repeated refund requests).</>,
            ]}
          />
          <div className="font-semibold text-white/85 mt-3">Beta and early-access plans</div>
          <div>
            If you are participating in a beta or early-access programme at a discounted or no-cost rate,
            no monetary refund applies. We may modify or end beta programmes with reasonable notice.
          </div>
        </Section>

        <Section title="8. Service availability">
          <Bullets
            items={[
              <>We aim to maintain high availability but do not guarantee any specific uptime percentage.</>,
              <>Scheduled maintenance will be communicated in advance where reasonably possible.</>,
              <>We are not liable for losses resulting from service interruptions, data delays, or temporary unavailability.</>,
            ]}
          />
        </Section>

        <Section title="9. Intellectual property">
          <div>
            The ChiefOS platform, including its design, software, trademarks, and documentation, is owned
            by {COMPANY} and protected by applicable intellectual property law. Nothing in these Terms
            transfers ownership of ChiefOS intellectual property to you.
          </div>
          <div>
            Any feedback, suggestions, or ideas you provide about the Service may be used by us without
            restriction or compensation.
          </div>
        </Section>

        <Section title="10. Aggregated and anonymized data">
          <div>
            ChiefOS may generate anonymized, aggregated datasets derived from platform activity across
            users. These datasets do not identify individual users or businesses and may be used internally
            to improve reliability, develop features, and conduct research.
          </div>
        </Section>

        <Section title="11. Warranty disclaimer">
          <div>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
            OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, CHIEFOS DISCLAIMS ALL WARRANTIES
            INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY OF AI OUTPUTS, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE, UNINTERRUPTED,
            OR FREE OF SECURITY VULNERABILITIES.
          </div>
        </Section>

        <Section title="12. Limitation of liability">
          <div>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHIEFOS'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS
            ARISING FROM OR RELATED TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU
            PAID TO CHIEFOS IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) CAD $100.
          </div>
          <div>
            IN NO EVENT WILL CHIEFOS BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST REVENUE, LOSS OF DATA, OR BUSINESS
            INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </div>
          <div>
            Some jurisdictions do not allow the exclusion of certain warranties or the limitation of
            certain damages, so some of the above limitations may not apply to you.
          </div>
        </Section>

        <Section title="13. Indemnification">
          <div>
            You agree to defend, indemnify, and hold harmless ChiefOS and its officers, employees, and
            agents from any claims, damages, or expenses (including reasonable legal fees) arising from:
          </div>
          <Bullets
            items={[
              <>your use of the Service in violation of these Terms,</>,
              <>your Customer Data infringing the rights of a third party, or</>,
              <>your violation of applicable law.</>,
            ]}
          />
        </Section>

        <Section title="14. Termination">
          <div className="font-semibold text-white/85">By you</div>
          <div>
            You may stop using the Service and close your account at any time. Cancellation of a paid
            plan is governed by Section 7.
          </div>
          <div className="font-semibold text-white/85 mt-2">By ChiefOS</div>
          <div>
            We may suspend or terminate your account if you violate these Terms, fail to pay fees, or
            engage in conduct that we reasonably believe harms the Service or other users. We will
            provide reasonable notice where possible, except where suspension is necessary to protect
            the platform or other users immediately.
          </div>
          <div>
            Upon termination, your right to access the Service ends. You may request an export of your
            Customer Data within 30 days of termination. After 30 days, we may delete your data
            consistent with our retention policies.
          </div>
        </Section>

        <Section title="15. Force majeure">
          <div>
            ChiefOS will not be liable for delays or failures in performance caused by circumstances
            beyond our reasonable control, including natural disasters, government actions, infrastructure
            failures, cyberattacks, or disruptions to third-party services we depend on.
          </div>
        </Section>

        <Section title="16. Governing law and disputes">
          <div>
            These Terms are governed by the laws of {JURISDICTION}, without regard to conflict of law
            principles. You agree that any dispute arising from these Terms or your use of the Service
            will be resolved exclusively in the courts of {JURISDICTION}.
          </div>
          <div>
            Before initiating formal proceedings, you agree to first contact us at {LEGAL_EMAIL} and
            give us 30 days to attempt to resolve the dispute informally.
          </div>
        </Section>

        <Section title="17. Changes to these terms">
          <div>
            We may update these Terms from time to time. We will notify you of material changes by
            email or by posting a notice in the platform at least 14 days before the changes take effect.
            Continued use of the Service after the effective date constitutes acceptance of the updated Terms.
          </div>
          <div>
            If you do not agree to updated Terms, you may cancel your account before the changes take effect.
          </div>
        </Section>

        <Section title="18. General">
          <Bullets
            items={[
              <>These Terms, together with the Privacy Policy and any applicable Order Forms, constitute the entire agreement between you and ChiefOS regarding the Service.</>,
              <>If any provision is found unenforceable, the remaining provisions continue in full force.</>,
              <>Our failure to enforce any right or provision is not a waiver of that right.</>,
              <>You may not assign your rights under these Terms without our written consent. We may assign our rights in connection with a merger, acquisition, or sale of assets.</>,
            ]}
          />
        </Section>

        <div className="text-xs text-white/45">
          ChiefOS is a product of {COMPANY}. Questions? Contact{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="underline">{LEGAL_EMAIL}</a>.
        </div>
      </div>
    </main>
  );
}
