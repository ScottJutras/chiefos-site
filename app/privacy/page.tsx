import Link from "next/link";

const LAST_UPDATED = "April 12, 2026";
const COMPANY = "9839429 Canada Inc. (operating as ChiefOS)";
const PRIVACY_EMAIL = "privacy@usechiefos.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6">
      <h2 className="text-lg font-semibold text-[#E8E2D8]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#A8A090]">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-[#A8A090]">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20 space-y-6">
        <div className="rounded-[28px] border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6">
          <div className="text-xs tracking-[0.18em] uppercase text-[#706A60]">Legal</div>

          <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-[#E8E2D8]">
            Privacy Policy
          </h1>

          <div className="mt-3 text-sm text-[#706A60]">Last updated: {LAST_UPDATED}</div>

          <div className="mt-4 text-sm text-[#A8A090] leading-relaxed">
            This Privacy Policy describes how {COMPANY} ("ChiefOS", "we", "us", "our") collects,
            uses, discloses, and protects personal information when you use our website, web portal,
            and messaging-based features (including WhatsApp ingestion). We are subject to the
            Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable
            Canadian provincial privacy laws.
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/terms" className="rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-4 py-2 text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition">
              Terms of Service
            </Link>
            <a href={`mailto:${PRIVACY_EMAIL}`} className="rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-4 py-2 text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition">
              {PRIVACY_EMAIL}
            </a>
          </div>
        </div>

        <Section title="1. What information we collect">
          <div className="font-semibold text-[#E8E2D8]">Account information</div>
          <Bullets
            items={[
              <>Email address and authentication credentials used to create and access your account.</>,
              <>Phone number, if you connect a messaging integration (e.g. WhatsApp).</>,
              <>Business name and profile information you provide during onboarding.</>,
            ]}
          />
          <div className="font-semibold text-[#E8E2D8] mt-3">Customer Data (business records)</div>
          <Bullets
            items={[
              <>Receipts, invoices, and financial documents you submit by photo, file upload, or email.</>,
              <>Transaction records including amounts, dates, vendors, categories, and job assignments.</>,
              <>Time entries, job records, tasks, and reminders you log through the platform.</>,
              <>Voice messages and text messages sent through connected messaging channels.</>,
              <>Metadata associated with submitted records (file names, timestamps, source channels).</>,
            ]}
          />
          <div className="font-semibold text-[#E8E2D8] mt-3">Usage and technical information</div>
          <Bullets
            items={[
              <>Page views, feature interactions, and navigation activity within the platform.</>,
              <>Device type, browser, operating system, and IP address.</>,
              <>Request timestamps, error logs, and security event logs.</>,
            ]}
          />
          <div className="font-semibold text-[#E8E2D8] mt-3">Payment information</div>
          <Bullets
            items={[
              <>Billing status and subscription tier. Payments are processed by Stripe and we do not store full card numbers or CVV codes.</>,
            ]}
          />
        </Section>

        <Section title="2. How we use information">
          <Bullets
            items={[
              <>Operate, maintain, and improve the Service.</>,
              <>Process and organize business records you submit.</>,
              <>Generate AI-assisted insights, summaries, and answers about your business data.</>,
              <>Authenticate your identity and protect account security.</>,
              <>Send transactional communications such as receipts, account alerts, and support responses.</>,
              <>Send product updates, feature announcements, and relevant offers (you may opt out — see Section 9).</>,
              <>Comply with applicable laws and respond to lawful requests from authorities.</>,
              <>Investigate and prevent fraud, abuse, and security incidents.</>,
            ]}
          />
        </Section>

        <Section title="3. Artificial intelligence and automated processing">
          <div>
            ChiefOS uses AI systems to analyze submitted records, categorize transactions, extract data
            from receipts, generate summaries, and answer questions about your business activity.
          </div>
          <div>
            These systems process your Customer Data as part of the Service. AI-generated outputs are
            informational only and may contain inaccuracies. You remain responsible for reviewing
            important financial or operational decisions.
          </div>
          <div>
            We do not use individually identifiable Customer Data to train third-party AI models without
            your consent. Aggregated and de-identified data may be used to improve our own systems
            (see Section 4).
          </div>
        </Section>

        <Section title="4. Platform analytics and supplier intelligence">
          <div>
            ChiefOS may create aggregated, anonymized, or de-identified datasets derived from platform activity.
            This section explains how that data is generated, protected, and used.
          </div>
          <div>
            <strong className="text-[#E8E2D8]">What we collect for analytics purposes.</strong> As part of normal
            operation of the Service, ChiefOS records which products from supplier catalogs you select or quote during
            job costing and purchasing workflows, the quantities involved, the general region your account is
            associated with (province/state level), and the timing and frequency of those selections. This activity
            data is collected regardless of whether you complete a purchase.
          </div>
          <div>
            <strong className="text-[#E8E2D8]">How we aggregate and anonymize it.</strong> Raw quoting activity is
            processed through an aggregation pipeline that: (a) strips all tenant-identifying fields (tenant_id,
            owner_id, user_id, job IDs, business names); (b) groups data by product, region, and time period; and
            (c) suppresses any data point that does not represent activity from at least five (5) distinct business
            accounts (k-anonymity threshold). The result is statistical market intelligence — demand counts, trend
            lines, and regional breakdowns — with no path back to any individual business.
          </div>
          <div>
            <strong className="text-[#E8E2D8]">What we share with suppliers.</strong> ChiefOS may provide Aggregated
            Analytics to suppliers participating in our Supplier Portal, including as a paid feature. Suppliers
            receive only: product-level demand counts, regional demand distributions (province/state level or coarser),
            seasonal trend data, and category comparison data. Suppliers never receive your business name, tenant ID,
            specific job details, financial data, employee information, or any data that could identify you.
          </div>
          <div>
            <strong className="text-[#E8E2D8]">What we never share.</strong> We never sell, rent, or disclose your
            individual Customer Data — financial records, job details, crew information, Ask Chief conversations,
            receipts, or documents — to any supplier or third party for commercial purposes.
          </div>
          <div>
            <strong className="text-[#E8E2D8]">Your opt-out right.</strong> You may opt out of having your quoting
            activity included in Aggregated Analytics shared with suppliers by emailing{" "}
            <a href="mailto:privacy@usechiefos.com" className="text-[#D4A853] underline">privacy@usechiefos.com</a>.
            We will action your request within 30 days. Opting out does not affect your access to the Service.
          </div>
          <div>
            These datasets cannot reasonably be used to reconstruct individual customer records and may also be used
            internally to improve platform reliability, develop new features, conduct research, and refine machine
            learning systems.
          </div>
        </Section>

        <Section title="5. How we share information">
          <div>
            We do not sell personal information. We share information only when necessary to operate
            the Service or comply with legal obligations.
          </div>
          <div className="font-semibold text-[#E8E2D8] mt-3">Service providers (subprocessors)</div>
          <Bullets
            items={[
              <><strong className="text-[#E8E2D8]">Supabase</strong> — authentication, database storage, and file storage.</>,
              <><strong className="text-[#E8E2D8]">Vercel</strong> — application hosting and delivery.</>,
              <><strong className="text-[#E8E2D8]">Twilio</strong> — messaging infrastructure for WhatsApp ingestion.</>,
              <><strong className="text-[#E8E2D8]">Stripe</strong> — subscription billing and payment processing.</>,
              <><strong className="text-[#E8E2D8]">OpenAI / Anthropic</strong> — AI model providers used to process submitted records and generate insights.</>,
              <><strong className="text-[#E8E2D8]">SendGrid / Postmark</strong> — transactional email delivery.</>,
            ]}
          />
          <div>
            All service providers are bound by data processing agreements and are permitted to use
            your information only as needed to provide their services to us.
          </div>
          <div className="font-semibold text-[#E8E2D8] mt-3">Legal requirements</div>
          <div>
            We may disclose information if required to do so by law, court order, or lawful request
            from a government authority, or where we believe disclosure is necessary to protect the
            rights, property, or safety of ChiefOS, our users, or the public.
          </div>
          <div className="font-semibold text-[#E8E2D8] mt-3">Business transfers</div>
          <div>
            If ChiefOS is involved in a merger, acquisition, or sale of assets, your information may
            be transferred as part of that transaction. We will provide notice before your information
            becomes subject to a different privacy policy.
          </div>
        </Section>

        <Section title="6. Cookies and tracking">
          <div>
            Our website and portal use cookies and similar technologies to support authentication,
            remember your preferences, and understand how users navigate the platform.
          </div>
          <div className="font-semibold text-[#E8E2D8] mt-3">Types of cookies we use</div>
          <Bullets
            items={[
              <><strong className="text-[#E8E2D8]">Essential cookies:</strong> Required for authentication and core platform functionality. Cannot be disabled.</>,
              <><strong className="text-[#E8E2D8]">Analytics cookies:</strong> Help us understand usage patterns to improve the Service. You may decline these.</>,
            ]}
          />
          <div>
            Most browsers allow you to control cookies through browser settings. Disabling essential
            cookies may prevent certain features from working.
          </div>
        </Section>

        <Section title="7. Data retention">
          <Bullets
            items={[
              <>Account and workspace data is retained while your account is active.</>,
              <>If you close your account, you may request an export of your data within 30 days. After that period, your data will be scheduled for deletion.</>,
              <>Deleted or purged records may persist in encrypted backups for up to 90 days before being permanently removed.</>,
              <>We may retain certain information longer where required by law or for legitimate business purposes (e.g., billing records for tax compliance).</>,
              <>Aggregated or anonymized data derived from your records may be retained indefinitely as it does not identify you.</>,
            ]}
          />
        </Section>

        <Section title="8. Security">
          <Bullets
            items={[
              <>All data is transmitted using HTTPS/TLS encryption.</>,
              <>Data at rest is stored using encrypted infrastructure provided by our hosting partners.</>,
              <>Access controls and least-privilege practices limit who can access your data internally.</>,
              <>Tenant isolation architecture prevents cross-account data access.</>,
              <>Security events are logged and monitored for anomalies.</>,
            ]}
          />
          <div>
            No method of transmission over the internet or electronic storage is 100% secure. While
            we take reasonable precautions, we cannot guarantee absolute security.
          </div>
        </Section>

        <Section title="9. Marketing communications and opt-out">
          <div>
            We may send you product updates, tips, and relevant offers by email. You can opt out of
            marketing communications at any time by:
          </div>
          <Bullets
            items={[
              <>Clicking "Unsubscribe" in any marketing email we send.</>,
              <>Emailing us at {PRIVACY_EMAIL} and requesting to be removed from marketing lists.</>,
            ]}
          />
          <div>
            Opting out of marketing emails will not affect transactional messages related to your
            account or subscription (e.g., receipts, security alerts, or support responses).
          </div>
        </Section>

        <Section title="10. Children's privacy">
          <div>
            The Service is intended for use by adults and is not directed at children under 18 years
            of age. We do not knowingly collect personal information from anyone under 18. If you
            believe we have inadvertently collected such information, please contact us at {PRIVACY_EMAIL}
            and we will delete it promptly.
          </div>
        </Section>

        <Section title="11. Your rights">
          <div>
            Subject to applicable law, you have the following rights regarding your personal information:
          </div>
          <Bullets
            items={[
              <><strong className="text-[#E8E2D8]">Access:</strong> Request a copy of the personal information we hold about you.</>,
              <><strong className="text-[#E8E2D8]">Correction:</strong> Request that inaccurate or incomplete information be corrected.</>,
              <><strong className="text-[#E8E2D8]">Deletion:</strong> Request that we delete your personal information, subject to our legal retention obligations.</>,
              <><strong className="text-[#E8E2D8]">Data portability:</strong> Request an export of your Customer Data in a machine-readable format.</>,
              <><strong className="text-[#E8E2D8]">Withdrawal of consent:</strong> Where processing is based on consent, you may withdraw it at any time. This will not affect processing already carried out.</>,
              <><strong className="text-[#E8E2D8]">Objection:</strong> Object to certain types of processing, including direct marketing.</>,
            ]}
          />
          <div>
            To exercise any of these rights, contact us at {PRIVACY_EMAIL}. We will respond within
            30 days. We may need to verify your identity before processing your request.
          </div>
          <div className="font-semibold text-[#E8E2D8] mt-3">US Privacy Rights</div>
          <div>
            <strong className="text-[#E8E2D8]">California Residents (CCPA/CPRA).</strong> If you are a California
            resident, you have the following additional rights: (1) the right to know what personal information we
            collect, use, disclose, and sell; (2) the right to delete personal information we have collected, subject
            to certain exceptions; (3) the right to opt out of the sale or sharing of your personal information;
            (4) the right to correct inaccurate personal information; and (5) the right to limit the use of sensitive
            personal information. ChiefOS does not sell personal information as defined under CCPA. The Aggregated
            Analytics described in Section 4 do not constitute a "sale" or "sharing" of personal information because
            the data is anonymized below the threshold of personal information before it is shared. To exercise any
            of these rights, contact {PRIVACY_EMAIL}.
          </div>
          <div>
            <strong className="text-[#E8E2D8]">Other US State Privacy Rights.</strong> Residents of Virginia
            (VCDPA), Colorado (CPA), Connecticut (CTDPA), Texas (TDPSA), and other states with comprehensive
            privacy laws have similar rights to access, correct, delete, and opt out of certain processing. ChiefOS
            honors these rights regardless of which US state you reside in. Contact {PRIVACY_EMAIL} to exercise
            any of these rights.
          </div>
        </Section>

        <Section title="12. Data breach notification">
          <div>
            In the event of a data breach that poses a real risk of significant harm to individuals,
            we will notify affected users and, where required by law, the relevant privacy commissioner.
            Notification will be provided without unreasonable delay and will include:
          </div>
          <Bullets
            items={[
              <>A description of what happened and what information was involved.</>,
              <>Steps we have taken or are taking to address the breach.</>,
              <>Steps you can take to reduce the risk of harm.</>,
              <>Contact information for further questions.</>,
            ]}
          />
        </Section>

        <Section title="13. International data transfers">
          <div>
            ChiefOS is a Canadian company (Ontario) and your data may be processed in Canada, the United States,
            and other jurisdictions where our infrastructure providers operate. For users in Canada, transfers to
            the US are subject to applicable legal orders in that jurisdiction. For users in the US, data processed
            in Canada is subject to Canadian privacy law (PIPEDA). We apply contractual and technical safeguards —
            including data processing agreements with all subprocessors — to protect your data regardless of where
            it is processed.
          </div>
          <div>
            Where data is transferred internationally, we take reasonable steps to ensure appropriate protections
            are in place consistent with PIPEDA and, for US users, applicable state privacy laws.
          </div>
        </Section>

        <Section title="14. Changes to this policy">
          <div>
            We may update this Privacy Policy as the Service evolves or legal requirements change.
            We will notify you of material changes by email or by posting a notice in the platform
            before the changes take effect. The "Last updated" date at the top of this page reflects
            the most recent revision.
          </div>
        </Section>

        <Section title="15. Contact us">
          <div>
            For privacy questions, access requests, or complaints, contact our privacy team:
          </div>
          <div className="mt-2">
            <div className="text-[#E8E2D8] font-semibold">ChiefOS Privacy</div>
            <div>9839429 Canada Inc.</div>
            <div>
              <a href={`mailto:${PRIVACY_EMAIL}`} className="underline hover:text-[#D4A853] transition">
                {PRIVACY_EMAIL}
              </a>
            </div>
          </div>
          <div>
            If you are not satisfied with our response, you may file a complaint with the Office of
            the Privacy Commissioner of Canada at{" "}
            <a href="https://www.priv.gc.ca" className="underline hover:text-[#D4A853] transition" target="_blank" rel="noopener noreferrer">
              priv.gc.ca
            </a>.
          </div>
        </Section>

        <div className="text-xs text-[#706A60]">
          ChiefOS is a product of 9839429 Canada Inc. This policy is provided for transparency.
          It is not legal advice.
        </div>
      </div>
    </main>
  );
}
