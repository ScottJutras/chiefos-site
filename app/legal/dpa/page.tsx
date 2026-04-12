import Link from "next/link";

const LAST_UPDATED = "April 12, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-6">
      <h2 className="text-lg font-semibold text-[#E8E2D8]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-[#A8A090] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function DPAPage() {
  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20 space-y-6">

      <div className="rounded-[28px] border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-[#706A60]">
          Legal
        </div>

        <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-[#E8E2D8]">
          Data Processing Agreement (DPA)
        </h1>

        <div className="mt-3 text-sm text-[#706A60]">
          Last updated: {LAST_UPDATED}
        </div>

        <div className="mt-4 text-sm text-[#A8A090]">
          This Data Processing Agreement explains how ChiefOS processes
          customer data on behalf of users of the Service.
        </div>

        <div className="mt-5">
          <Link href="/privacy" className="underline text-[#D4A853] hover:text-[#C49843]">
            Privacy Policy
          </Link>
        </div>
      </div>

      <Section title="Roles">
        <div>
          When using ChiefOS, the customer acts as the data controller and ChiefOS acts as the data
          processor for customer-submitted data (financial records, job data, employee information, documents).
          ChiefOS processes this data only as instructed by your use of the Service.
        </div>
        <div>
          For Aggregated Analytics derived from anonymized usage patterns (as described in the Privacy Policy),
          ChiefOS acts as a data <strong>controller</strong> — this data has been anonymized below the threshold
          of personal information, and ChiefOS determines the purpose and means of its use and disclosure. The
          protections of this DPA apply to Customer Data in ChiefOS's role as processor; Aggregated Analytics
          are governed by the Privacy Policy.
        </div>
      </Section>

      <Section title="Scope of processing">
        <div>
          ChiefOS processes customer data only as necessary to provide and maintain the Service.
        </div>

        <div>Processing activities may include:</div>

        <ul className="list-disc pl-5 space-y-2">
          <li>storing submitted records</li>
          <li>organizing financial and operational information</li>
          <li>generating analytics and summaries</li>
          <li>system reliability and monitoring</li>
          <li>
            generating anonymized, aggregated platform analytics for market intelligence purposes
            (Aggregated Analytics), subject to the anonymization and k-anonymity standards described in
            the Privacy Policy — in this context ChiefOS acts as data controller, not processor
          </li>
        </ul>
      </Section>

      <Section title="Security measures">
        <ul className="list-disc pl-5 space-y-2">
          <li>encrypted data transmission</li>
          <li>role-based access controls</li>
          <li>tenant data isolation</li>
          <li>infrastructure security monitoring</li>
        </ul>
      </Section>

      <Section title="Subprocessors">
        <div>ChiefOS uses trusted infrastructure providers including:</div>

        <ul className="list-disc pl-5 space-y-2">
          <li>Supabase (database and authentication)</li>
          <li>Vercel (hosting infrastructure)</li>
          <li>Stripe (billing)</li>
          <li>Twilio (messaging infrastructure)</li>
        </ul>
      </Section>

      <Section title="Data retention and deletion">
        <div>
          Customer data is retained only for the duration of the customer’s account unless required for
          legal or operational purposes.
        </div>

        <div>
          Customers may request deletion of their account and associated workspace data.
        </div>

        <div>
          Anonymized and aggregated data (which contains no personal information and cannot be traced back
          to any individual business) may be retained indefinitely for analytics, benchmarking, and market
          intelligence purposes, consistent with ChiefOS’s role as controller for that data class.
        </div>
      </Section>

      <Section title="International transfers">
        <div>
          Data may be processed in multiple jurisdictions depending on the
          infrastructure providers used to operate the Service.
        </div>
      </Section>

      </div>
    </main>
  );
}