// app/privacy/page.tsx
export const metadata = {
  title: "Privacy Policy — ChiefOS",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white/95">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const effective = "February 27, 2026";
  const contact = "support@usechiefos.com";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">Legal</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Privacy Policy
        </h1>
        <div className="mt-3 text-sm text-white/60">Effective: {effective}</div>
      </div>

      <Section title="What ChiefOS is">
        <p>
          ChiefOS is a trust-first operating system that helps a business owner capture real business activity
          (expenses, revenue, time, jobs, tasks, and receipts) and then ask questions grounded only in their own data.
        </p>
      </Section>

      <Section title="What we collect">
        <p>Depending on how you use ChiefOS, we may collect:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="text-white/85 font-medium">Account data</span>: email, login identifiers, and basic profile info.
          </li>
          <li>
            <span className="text-white/85 font-medium">Business data you submit</span>: transactions, job info, time logs, tasks, and notes.
          </li>
          <li>
            <span className="text-white/85 font-medium">Evidence</span>: receipt photos, PDFs, attachments, and related metadata you upload or forward.
          </li>
          <li>
            <span className="text-white/85 font-medium">Usage + diagnostics</span>: basic logs needed to keep the service reliable and secure.
          </li>
        </ul>
      </Section>

      <Section title="What we do with your data">
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide the product (capture, review, exports, and trustworthy answers).</li>
          <li>Secure the platform (fraud prevention, abuse prevention, incident response).</li>
          <li>Operate and improve reliability (debugging, performance).</li>
        </ul>
        <p className="pt-2">
          We do not sell your personal information.
        </p>
      </Section>

      <Section title="How we share data">
        <p>
          We share data only with service providers (“subprocessors”) needed to run ChiefOS, such as:
          hosting, database/storage, messaging delivery, and billing.
        </p>
        <p>
          Typical subprocessors include providers for hosting, database/storage, messaging, and payments (e.g. Vercel,
          Supabase, Twilio, Stripe). We share only what’s needed to deliver the service.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep your data while your account is active. If you delete your workspace data or delete your account,
          we will delete or de-identify data within a reasonable period, unless we must keep certain records to comply
          with law, resolve disputes, or enforce agreements.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use reasonable administrative, technical, and physical safeguards designed to protect your information.
          No method of transmission or storage is 100% secure, but we work to prevent unauthorized access.
        </p>
      </Section>

      <Section title="Your choices">
        <ul className="list-disc pl-5 space-y-2">
          <li>You can access and update certain account information in the portal.</li>
          <li>You can request deletion of your data or account through Settings.</li>
          <li>
            If you need help, contact us at <span className="text-white/85 font-medium">{contact}</span>.
          </li>
        </ul>
      </Section>

      <Section title="Changes">
        <p>
          We may update this policy from time to time. If we make material changes, we’ll post an updated effective date.
        </p>
      </Section>

      <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/65">
        Contact: <span className="text-white/85 font-medium">{contact}</span>
      </div>
    </main>
  );
}