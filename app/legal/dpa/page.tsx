import Link from "next/link";

const LAST_UPDATED = "March 8, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-white/70 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function DPAPage() {
  return (
    <main className="space-y-6">

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">
          Legal
        </div>

        <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-white/95">
          Data Processing Agreement (DPA)
        </h1>

        <div className="mt-3 text-sm text-white/60">
          Last updated: {LAST_UPDATED}
        </div>

        <div className="mt-4 text-sm text-white/70">
          This Data Processing Agreement explains how ChiefOS processes
          customer data on behalf of users of the Service.
        </div>

        <div className="mt-5">
          <Link href="/privacy" className="underline text-white/80">
            Privacy Policy
          </Link>
        </div>
      </div>

      <Section title="Roles">
        <div>
          When using ChiefOS, the customer acts as the data controller and
          ChiefOS acts as the data processor for customer-submitted data.
        </div>
      </Section>

      <Section title="Scope of processing">
        <div>
          ChiefOS processes customer data only as necessary to provide and
          maintain the Service.
        </div>

        <div>Processing activities may include:</div>

        <ul className="list-disc pl-5 space-y-2">
          <li>storing submitted records</li>
          <li>organizing financial and operational information</li>
          <li>generating analytics and summaries</li>
          <li>system reliability and monitoring</li>
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
          Customer data is retained only for the duration of the customer’s
          account unless required for legal or operational purposes.
        </div>

        <div>
          Customers may request deletion of their account and associated
          workspace data.
        </div>
      </Section>

      <Section title="International transfers">
        <div>
          Data may be processed in multiple jurisdictions depending on the
          infrastructure providers used to operate the Service.
        </div>
      </Section>

    </main>
  );
}