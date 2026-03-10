import React from "react";

export const LEGAL_TERMS_VERSION = "2026-03-10";
export const LEGAL_PRIVACY_VERSION = "2026-03-10";
export const LEGAL_AI_POLICY_VERSION = "2026-03-10";
export const LEGAL_DPA_VERSION = "2026-03-10";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg md:text-xl font-semibold text-white/95">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/72">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-sm text-white/72">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function LegalAgreementContent() {
  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="text-xs tracking-[0.18em] uppercase text-white/50">ChiefOS legal package</div>
        <h1 className="mt-3 text-2xl font-semibold text-white/95">Terms, Privacy, AI Policy, and DPA</h1>
        <div className="mt-3 text-sm text-white/65 leading-relaxed">
          This package explains the rules for using ChiefOS, how your data is handled, how automated systems are used,
          and how customer data is processed to operate the service.
        </div>

        <div className="mt-4 grid gap-2 text-xs text-white/55 md:grid-cols-2">
          <div>Terms version: {LEGAL_TERMS_VERSION}</div>
          <div>Privacy version: {LEGAL_PRIVACY_VERSION}</div>
          <div>AI Policy version: {LEGAL_AI_POLICY_VERSION}</div>
          <div>DPA version: {LEGAL_DPA_VERSION}</div>
        </div>
      </div>

      <Section id="terms" title="Terms of Service">
        <div>
          These Terms govern your use of ChiefOS, including the website, portal, messaging-based features, and any
          related operational tools.
        </div>

        <BulletList
          items={[
            <>ChiefOS may be offered as an early access or beta service and may evolve quickly.</>,
            <>You are responsible for maintaining the security of your account and the accuracy of the information you provide.</>,
            <>You retain ownership of the business records you submit to the platform.</>,
            <>By using the service, you authorize ChiefOS to process submitted data to operate, maintain, and improve the platform.</>,
            <>AI-generated outputs may contain errors and should not be treated as accounting, financial, or legal advice.</>,
            <>Do not use the service for illegal activity, unauthorized access attempts, or behavior that harms platform reliability.</>,
            <>Paid subscriptions are processed through Stripe. Failure to pay applicable fees may restrict access.</>,
            <>ChiefOS may create anonymized or aggregated data derived from platform activity to improve the service.</>,
            <>To the maximum extent permitted by law, ChiefOS is not liable for indirect or consequential damages arising from use of the service.</>,
            <>Continued use of the service after updates to these terms constitutes acceptance of the revised terms.</>,
          ]}
        />
      </Section>

      <Section id="privacy" title="Privacy Policy">
        <div>
          This Privacy Policy explains how ChiefOS collects, uses, and protects information when you use the website,
          portal, and messaging-based features.
        </div>

        <div className="font-medium text-white/85">What we collect</div>
        <BulletList
          items={[
            <>Account information such as email address, authentication identifiers, and connected phone number where applicable.</>,
            <>Business data submitted to the platform including receipts, transaction records, job information, notes, documents, and metadata.</>,
            <>Usage information such as request timestamps, page views, activity logs, and security events.</>,
            <>Payment status information related to plan billing. Full card details are handled by Stripe, not stored by ChiefOS.</>,
          ]}
        />

        <div className="font-medium text-white/85">How we use information</div>
        <BulletList
          items={[
            <>Provide and operate the service.</>,
            <>Organize and process submitted records.</>,
            <>Generate summaries and insights using automated systems.</>,
            <>Maintain reliability, security, and performance.</>,
            <>Communicate with users about support, product updates, and service operations.</>,
          ]}
        />

        <div className="font-medium text-white/85">How we share information</div>
        <BulletList
          items={[
            <>We do not sell personal information.</>,
            <>Information may be shared with service providers only as needed to operate the service.</>,
            <>Current infrastructure providers may include Supabase, Vercel, Stripe, and Twilio.</>,
          ]}
        />

        <div className="font-medium text-white/85">Retention and security</div>
        <BulletList
          items={[
            <>Workspace data is retained while your account is active unless deletion is requested or required by law.</>,
            <>Deleted information may persist temporarily in backups.</>,
            <>ChiefOS uses encryption in transit, access controls, and tenant isolation patterns to reduce cross-workspace risk.</>,
          ]}
        />
      </Section>

      <Section id="ai-policy" title="AI Usage Policy">
        <div>
          ChiefOS uses automated systems and machine learning to help interpret submitted business records and generate
          operational insights.
        </div>

        <div className="font-medium text-white/85">How AI is used</div>
        <BulletList
          items={[
            <>Categorizing submitted receipts and records.</>,
            <>Generating summaries of business activity.</>,
            <>Identifying patterns across transactions, jobs, and activity logs.</>,
            <>Helping users ask questions about their business data and receive grounded answers.</>,
          ]}
        />

        <div className="font-medium text-white/85">Limitations</div>
        <BulletList
          items={[
            <>AI-generated outputs may contain inaccuracies or incomplete interpretations.</>,
            <>Users remain responsible for reviewing important financial, legal, tax, or operational decisions.</>,
            <>ChiefOS is intended to assist business owners, not replace professional advice.</>,
          ]}
        />

        <div className="font-medium text-white/85">Improvement and training</div>
        <BulletList
          items={[
            <>ChiefOS may use aggregated, anonymized, or de-identified datasets derived from platform activity to improve systems and product performance.</>,
            <>These datasets are designed to avoid identifying specific users or businesses.</>,
          ]}
        />
      </Section>

      <Section id="dpa" title="Data Processing Agreement (DPA)">
        <div>
          This DPA explains how ChiefOS processes customer data on behalf of users of the service.
        </div>

        <div className="font-medium text-white/85">Roles</div>
        <BulletList
          items={[
            <>The customer acts as the data controller for customer-submitted data.</>,
            <>ChiefOS acts as the data processor to the extent needed to provide and maintain the service.</>,
          ]}
        />

        <div className="font-medium text-white/85">Scope of processing</div>
        <BulletList
          items={[
            <>Storing submitted records.</>,
            <>Organizing financial and operational information.</>,
            <>Generating analytics, summaries, and operational views.</>,
            <>Supporting reliability, monitoring, and security operations.</>,
          ]}
        />

        <div className="font-medium text-white/85">Security measures</div>
        <BulletList
          items={[
            <>Encrypted data transmission.</>,
            <>Role-based access controls.</>,
            <>Tenant isolation patterns.</>,
            <>Operational monitoring and infrastructure security practices.</>,
          ]}
        />

        <div className="font-medium text-white/85">Subprocessors</div>
        <BulletList
          items={[
            <>Supabase for database and authentication.</>,
            <>Vercel for hosting infrastructure.</>,
            <>Stripe for billing operations.</>,
            <>Twilio for messaging infrastructure.</>,
          ]}
        />

        <div className="font-medium text-white/85">Retention and transfers</div>
        <BulletList
          items={[
            <>Customer data is retained only as necessary to operate the service, satisfy legal obligations, or honor account retention requirements.</>,
            <>Data may be processed in multiple jurisdictions depending on infrastructure providers.</>,
          ]}
        />
      </Section>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/50">
        This document is provided for operational clarity and transparency. It is not legal advice.
      </div>
    </div>
  );
}