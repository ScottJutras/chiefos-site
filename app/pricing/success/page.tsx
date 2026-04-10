// app/pricing/success/page.tsx
import Link from "next/link";

function prettyPlan(planRaw: string) {
  const plan = (planRaw || "").toLowerCase().trim();
  if (!plan) return "your plan";

  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  if (plan === "free") return "Free";

  // fallback: Title Case-ish
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export default function PricingSuccessPage({
  searchParams,
}: {
  searchParams?: { plan?: string; session_id?: string };
}) {
  const plan = searchParams?.plan || "";
  const pretty = prettyPlan(plan);

  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]">
      <div className="mx-auto max-w-xl px-6 py-14">
        <div className="rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-6">
          <div className="text-sm text-[#A8A090]">Payment complete</div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#E8E2D8]">
            You’re set — {pretty} is active.
          </h1>

          <p className="mt-3 text-sm text-[#A8A090]">
            If Billing doesn’t update immediately, refresh once. (Subscriptions are applied by webhook.)
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/settings/billing?success=1"
              className="rounded-[2px] bg-[#D4A853] px-4 py-2 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition"
            >
              Go to Billing
            </Link>

            <Link
              href="/app/dashboard"
              className="rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-transparent px-4 py-2 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.08)] transition"
            >
              Go to Dashboard
            </Link>
          </div>

          <div className="mt-4 text-[11px] text-[#706A60]">
            Success URL: /pricing/success{plan ? `?plan=${encodeURIComponent(plan)}` : ""}
          </div>
        </div>
      </div>
    </main>
  );
}