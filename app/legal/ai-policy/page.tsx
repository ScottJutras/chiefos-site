import Link from "next/link";

const LAST_UPDATED = "April 12, 2026";
const PRIVACY_EMAIL = "privacy@usechiefos.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6">
      <h2 className="text-lg font-semibold text-[#E8E2D8]">{title}</h2>
      <div className="mt-3 text-sm text-[#A8A090] space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-sm text-[#A8A090]">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export default function AIUsagePolicyPage() {
  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20 space-y-6">
        <div className="rounded-[28px] border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6">
          <div className="text-xs tracking-[0.18em] uppercase text-[#706A60]">Legal</div>

          <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-[#E8E2D8]">
            AI Usage Policy
          </h1>

          <div className="mt-3 text-sm text-[#706A60]">Last updated: {LAST_UPDATED}</div>

          <div className="mt-4 text-sm text-[#A8A090] leading-relaxed">
            This policy explains how ChiefOS uses artificial intelligence and automated systems
            within the Service — what we use them for, which providers we rely on, how your data
            is handled, and what the known limitations are.
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/privacy" className="rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-4 py-2 text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-4 py-2 text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition">
              Terms of Service
            </Link>
          </div>
        </div>

        <Section title="1. Purpose of AI systems">
          <div>
            ChiefOS uses machine learning and automated systems to help you understand your business.
            AI assists with interpreting records you submit and generating operational insights — it
            does not make decisions on your behalf.
          </div>
          <div>
            Our goal is to give you accurate, timely information about your jobs, expenses, revenue,
            and time so you can make informed business decisions faster.
          </div>
        </Section>

        <Section title="2. How AI is used">
          <div>AI systems are used for the following functions within ChiefOS:</div>
          <Bullets
            items={[
              <><strong className="text-[#E8E2D8]">Receipt and document parsing:</strong> Extracting amounts, vendors, dates, and line items from photos and files you submit.</>,
              <><strong className="text-[#E8E2D8]">Transaction categorization:</strong> Classifying submitted expenses and revenue into categories relevant to your business.</>,
              <><strong className="text-[#E8E2D8]">Job intelligence:</strong> Summarizing job-level financial activity including expenses, revenue, labour, and margin.</>,
              <><strong className="text-[#E8E2D8]">Ask Chief (conversational insights):</strong> Answering natural language questions about your business data using your actual records as context.</>,
              <><strong className="text-[#E8E2D8]">Anomaly detection:</strong> Identifying unusual patterns in submitted data (e.g. vendor spikes, margin drops) and surfacing them proactively.</>,
              <><strong className="text-[#E8E2D8]">Voice and message transcription:</strong> Converting voice notes and text messages into structured business records.</>,
              <><strong className="text-[#E8E2D8]">Proactive summaries:</strong> Generating weekly digests, job updates, and cash flow projections from your real data.</>,
              <><strong className="text-[#E8E2D8]">Supplier analytics (statistical, not AI):</strong> The demand intelligence data shared with supplier partners — which products are being quoted, regional patterns, seasonal trends — is generated through statistical aggregation (counting, grouping, and anonymizing product selection events). This is not AI-generated and does not involve language models or machine learning inference on your individual data. If ChiefOS introduces AI-powered demand forecasting features for suppliers in the future, we will disclose this separately and clearly label which outputs are AI-generated estimates versus statistical facts.</>,
            ]}
          />
        </Section>

        <Section title="3. AI providers we use">
          <div>
            ChiefOS uses the following third-party AI providers to power its features:
          </div>
          <Bullets
            items={[
              <><strong className="text-[#E8E2D8]">OpenAI</strong> — Used for receipt parsing, document OCR, transaction categorization, and structured data extraction. Data sent to OpenAI is governed by OpenAI's API data usage policies.</>,
              <><strong className="text-[#E8E2D8]">Anthropic</strong> — Used for financial reasoning, complex queries via Ask Chief, and analysis tasks requiring deeper contextual understanding.</>,
            ]}
          />
          <div>
            Both providers operate under enterprise API agreements that restrict them from using
            customer-submitted data to train their general models. Your business records are not
            used to train third-party AI models without your consent.
          </div>
        </Section>

        <Section title="4. What data is sent to AI providers">
          <div>
            When you use AI-powered features, relevant portions of your submitted data are sent to
            the AI provider to generate a response. This may include:
          </div>
          <Bullets
            items={[
              <>Text content of messages, notes, and descriptions you submit.</>,
              <>Image data from receipts and documents you upload for processing.</>,
              <>Aggregated financial summaries used to answer Ask Chief questions (amounts, categories, dates, job identifiers).</>,
            ]}
          />
          <div>
            We minimize the data sent to AI providers to what is necessary for the specific function.
            We do not send unrelated personal information, authentication credentials, or payment card details to AI providers.
          </div>
        </Section>

        <Section title="5. Limitations and known risks">
          <div>
            AI systems are powerful but not perfect. You should be aware of the following:
          </div>
          <Bullets
            items={[
              <><strong className="text-[#E8E2D8]">Inaccuracies:</strong> AI-generated outputs may contain errors, misclassifications, or omissions. Always verify important figures independently.</>,
              <><strong className="text-[#E8E2D8]">Not professional advice:</strong> Nothing generated by ChiefOS constitutes accounting, tax, legal, or financial advice. Consult qualified professionals for decisions in those areas.</>,
              <><strong className="text-[#E8E2D8]">Context limitations:</strong> AI outputs are only as accurate as the data you submit. Incomplete or incorrect records will produce less reliable insights.</>,
              <><strong className="text-[#E8E2D8]">Hallucinations:</strong> AI models can occasionally generate plausible-sounding but incorrect information. Treat AI outputs as a starting point, not a final answer.</>,
              <><strong className="text-[#E8E2D8]">Receipt parsing variability:</strong> Complex or unclear receipts may be parsed incorrectly. Review extracted data before confirming records.</>,
            ]}
          />
        </Section>

        <Section title="6. Human review">
          <div>
            Before any AI-extracted record is written to your books, ChiefOS presents the result to
            you for confirmation. You retain full control — no record is saved without your explicit
            approval through a confirmation step.
          </div>
          <div>
            You can correct any AI-generated categorization, amount, or description before confirming.
            Your corrections help improve accuracy for future records within your workspace.
          </div>
        </Section>

        <Section title="7. Training and model improvement">
          <div>
            ChiefOS may use aggregated, anonymized datasets derived from platform activity to improve
            its own internal systems and prompts. These datasets are designed to prevent identification
            of specific users or businesses.
          </div>
          <div>
            We do not provide your identifiable Customer Data to third-party AI providers for general
            model training purposes.
          </div>
        </Section>

        <Section title="8. Cryptographic record integrity">
          <div>
            Financial records created through ChiefOS are protected by SHA-256 cryptographic hash
            chains. Each transaction is linked to the previous one in a tamper-evident sequence.
            This means:
          </div>
          <Bullets
            items={[
              <>Any modification to a stored record is detectable through integrity verification.</>,
              <>Records can be verified for authenticity at any time from Settings → Data Integrity.</>,
              <>Hash chains are maintained regardless of your subscription plan.</>,
            ]}
          />
          <div>
            This feature is designed to support trust in your financial records for audits, insurance
            claims, and client disputes.
          </div>
        </Section>

        <Section title="9. Your controls">
          <div>You can manage AI features and data handling in the following ways:</div>
          <Bullets
            items={[
              <>Review and correct all AI-extracted data before it is saved.</>,
              <>Delete records from your workspace at any time through the portal.</>,
              <>Request a full export of your data by contacting {PRIVACY_EMAIL}.</>,
              <>Request deletion of your account and associated records by contacting {PRIVACY_EMAIL}.</>,
            ]}
          />
        </Section>

        <Section title="10. Changes to this policy">
          <div>
            As AI capabilities and provider relationships evolve, we may update this policy. Material
            changes will be communicated by email or via an in-platform notice before taking effect.
          </div>
        </Section>

        <div className="text-xs text-[#706A60]">
          Questions about how AI is used in ChiefOS? Contact{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="underline">{PRIVACY_EMAIL}</a>.
        </div>
      </div>
    </main>
  );
}
