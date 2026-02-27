// app/terms/page.tsx
export const metadata = {
  title: "Terms of Service — ChiefOS",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white/95">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const effective = "February 27, 2026";
  const contact = "support@usechiefos.com";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">Legal</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Terms of Service
        </h1>
        <div className="mt-3 text-sm text-white/60">Effective: {effective}</div>
      </div>

      <Section title="Agreement">
        <p>
          By accessing or using ChiefOS, you agree to these Terms. If you do not agree, do not use the service.
        </p>
      </Section>

      <Section title="What ChiefOS provides">
        <p>
          ChiefOS helps you capture and review business activity and generate outputs (like summaries and exports)
          based on the information you provide. You are responsible for confirming your data and how you use it.
        </p>
      </Section>

      <Section title="Your responsibilities">
        <ul className="list-disc pl-5 space-y-2">
          <li>You must provide accurate information and keep your account secure.</li>
          <li>You are responsible for any activity under your account.</li>
          <li>You must not misuse the service, attempt unauthorized access, or interfere with reliability.</li>
        </ul>
      </Section>

      <Section title="Beta disclaimer">
        <p>
          ChiefOS may be offered as a beta. Beta features may change, be limited, or be discontinued. We do our best to
          keep the system stable and trustworthy, but you should not rely on beta features as your only recordkeeping system.
        </p>
      </Section>

      <Section title="Fees and subscriptions">
        <p>
          If you subscribe to a paid plan, you agree to pay applicable fees and taxes. Features and quotas may vary by plan.
          If plan or quota resolution fails, some features may be blocked to protect your account and the system.
        </p>
      </Section>

      <Section title="Data deletion">
        <p>
          You can request deletion of your workspace data or account through Settings. Some records may be retained when
          required for legal, security, or operational reasons.
        </p>
      </Section>

      <Section title="Intellectual property">
        <p>
          ChiefOS and related software are owned by ChiefOS (or its licensors). You retain rights to the content you submit,
          subject to the permissions you grant for us to operate the service.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, ChiefOS is provided “as is” and we are not liable for indirect, incidental,
          special, consequential, or punitive damages, or any loss of profits or revenues.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions? Contact us at <span className="text-white/85 font-medium">{contact}</span>.
        </p>
      </Section>
    </main>
  );
}