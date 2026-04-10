// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\pricing\page.tsx
import SiteHeader from "@/app/components/marketing/SiteHeader";
import Section from "@/app/components/marketing/Section";
import SiteFooter from "@/app/components/marketing/SiteFooter";
import CheckoutButton from "@/app/components/marketing/CheckoutButton";
import PricingFAQ from "@/app/pricing/PricingFAQ";

function Check() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.1)]">
      <span className="h-2 w-2 rounded-full bg-[#D4A853]" />
    </span>
  );
}

type PaidPlan = "starter" | "pro";

function normalizePaidPlan(x: any): PaidPlan | null {
  const s = String(x ?? "").toLowerCase().trim();
  if (s === "starter") return "starter";
  if (s === "pro") return "pro";
  return null;
}

function getPhoneFromSearchParams(sp: any): string | undefined {
  const raw = sp?.phone ? String(sp.phone) : "";
  const phone = raw.trim();
  return phone ? phone : undefined;
}

function PricingCard({
  name,
  price,
  blurb,
  features,
  paidPlan,
  phone,
  highlighted,
  badge,
}: {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  paidPlan?: PaidPlan; // if present -> Stripe checkout
  phone?: string;
  highlighted?: boolean;
  badge?: string;
}) {
  const btnBase =
    "mt-6 inline-flex w-full items-center justify-center rounded-[2px] px-4 py-3 text-sm font-semibold transition h-11";
  const btnPrimary = "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#C49843]";
  const btnSecondary = "border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)]";
  const buttonClass = [btnBase, highlighted ? btnPrimary : btnSecondary].join(" ");

  return (
    <div
      className={[
        "relative rounded-[28px] border p-6 md:p-7",
        highlighted
          ? "border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.06)] shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
          : "border-[rgba(212,168,83,0.15)] bg-[#0F0E0C]",
      ].join(" ")}
    >
      {(badge || highlighted) && (
        <div className="absolute -top-3 left-6 rounded-full border border-[rgba(212,168,83,0.3)] bg-[#0C0B0A] px-3 py-1 text-xs text-[#D4A853] backdrop-blur">
          {badge || "Most popular"}
        </div>
      )}

      <div className="text-sm font-semibold text-[#E8E2D8]">{name}</div>

      <div className="mt-2 flex items-end gap-2">
        <div className="text-4xl font-bold tracking-tight text-[#E8E2D8]">{price}</div>
        <div className="pb-1 text-sm text-[#A8A090]">/ month</div>
      </div>

      <p className="mt-3 text-sm text-[#A8A090] leading-relaxed">{blurb}</p>

      {/* ✅ single CTA per card */}
      {paidPlan ? (
        <CheckoutButton plan={paidPlan} phone={phone} className={buttonClass}>
          Get it now
        </CheckoutButton>
      ) : (
        <a href="/wa?t=free" className={buttonClass}>
          Start free
        </a>
      )}

      <div className="mt-6 space-y-3">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-3 text-sm text-[#A8A090]">
            <Check />
            <div className="leading-relaxed">{f}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQRow({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[rgba(212,168,83,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <div className="text-sm font-semibold text-[#E8E2D8]">{q}</div>

        <div
          className={[
            "inline-flex h-8 w-8 items-center justify-center rounded-xl",
            "border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] text-[#A8A090] text-lg font-semibold",
          ].join(" ")}
          aria-hidden="true"
        >
          {open ? "−" : "+"}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 -mt-2 text-sm text-[#A8A090] leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

export default function PricingPage({ searchParams }: { searchParams?: any }) {
  const phone = getPhoneFromSearchParams(searchParams);

  // ✅ used only for highlight + optional sticky bar
  const selectedPlan: PaidPlan = normalizePaidPlan(searchParams?.plan) || "starter";
  const hasPlanIntent = !!normalizePaidPlan(searchParams?.plan);

  const selectedLabel =
    selectedPlan === "pro" ? "Pro — Crew + Control" : "Starter — Owner Mode";
  const selectedPrice = selectedPlan === "pro" ? "$149/mo" : "$59/mo";

  const faqs = [
    {
      q: "What happens when I hit a plan limit?",
      a: "Capture never stops. If you hit a limit, the upgrade-only features pause (like OCR, voice, exports, or crew logging) and we tell you exactly what boundary you hit.",
    },
    {
      q: "Can my crew use Ask Chief?",
      a: "No. Crew are the senses — they capture. Owners use Ask Chief to reason from the records.",
    },
    {
      q: "What does ‘Approvals + Audit’ mean in Pro?",
      a: "Sensitive edits can require approval before totals change. Every change is traceable: who changed what, when, and what job it touched.",
    },
    {
      q: "Is my data trapped?",
      a: "No. Paid plans support exports (CSV/XLS/PDF). If you ever leave, your records leave with you.",
    },
  ];

  // simple server-component accordion state via URL is overkill; use CSS-only behavior by rendering all closed:
  // for now we’ll open none by default and toggle client-side later only if you want it.
  // We'll keep it static-friendly: open the first one.
  const openIndex = 0;

  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <SiteHeader />

      {/* ✅ Intent-only sticky bar (only when /pricing?plan=pro|starter) */}
      {hasPlanIntent && (
        <div className="sticky top-0 z-40 border-b border-[rgba(212,168,83,0.15)] bg-[#0C0B0A]/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[#A8A090]">
                Selected{" "}
                <span className="text-[#E8E2D8] font-semibold">{selectedLabel}</span>{" "}
                <span className="text-[#706A60]">({selectedPrice})</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <CheckoutButton
                  plan={selectedPlan}
                  phone={phone}
                  className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-4 py-2 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
                >
                  Continue to checkout
                </CheckoutButton>

                <a href="#plans" className="text-xs text-[#A8A090] hover:text-[#D4A853] underline">
                  Change
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HERO (no big CTAs; keep it clean) */}
      <Section className="pt-20 md:pt-24 pb-10 md:pb-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs text-[#D4A853]">
            Plans
          </div>

          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] text-[#E8E2D8]">
            Pick the plan that matches
            <br />
            how you run work.
          </h1>

          <p className="mt-4 text-lg md:text-xl text-[#A8A090] leading-relaxed">
            Capture first. Upgrade when you want more speed, structure, and control.
          </p>
        </div>
      </Section>

      {/* PLANS (this is the conversion surface) */}
      <Section id="plans" className="pb-12 md:pb-14">
        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            name="Free — Field Capture"
            price="$0"
            blurb="Step into conversational bookkeeping"
            features={[
              "1 Owner",
              "3 Jobs",
              "Text",
              "Full suite of integrated tool",
              "Exports",
            ]}
          />

          <PricingCard
            name="Starter — Owner Mode"
            price="$59"
            blurb="State of the art conversational bookkeeping"
            paidPlan="starter"
            phone={phone}
            highlighted={selectedPlan === "starter"}
            features={[
              "1 Owner", 
              "Track up to 10 Employees",
              "25 Jobs",
              "Text, Voice, Images",
              "Full suite of integrated tools",
              "Ask Chief",
              "Exports",
            ]}
          />

          <PricingCard
            name="Pro — Crew + Control"
            price="$149"
            blurb="State of the art conversational Financial Management"
            paidPlan="pro"
            phone={phone}
            highlighted={selectedPlan === "pro"}
            badge="Crew + Control"
            features={[
              "1 Owner",
              "Track up to 150 Employees: Log capabilities",
              "Up to 25 Board Members: Log + Approve + Edit capabilities",
              "Unlimited Jobs",
              "Text, Voice, Images",
              "Ask Chief",
              "Approvals + full audit trail",
              "Priority onboarding (white glove setup)",
              "Exports",
            ]}
          />
        </div>
      </Section>

        {/* FAQ (interactive accordion) */}
      <Section className="pb-16 md:pb-20">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold text-[#E8E2D8]">FAQ</div>

          <div className="mt-6">
            <PricingFAQ items={faqs} defaultOpenIndex={0} />
          </div>

           <p className="mt-4 text-lg md:text-xl text-[#A8A090] leading-relaxed">
            Still unsure? Don't be. Make more money every single hour with ChiefOS.
          </p>
        </div>
      </Section>

      <SiteFooter
        brandLine="Stop stacking apps. Start running a system."
        subLine="Capture on the go: Text. Voice. Audio. Ask Chief."
      />
    </main>
  );
}