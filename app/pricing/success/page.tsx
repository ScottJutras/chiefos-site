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
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-14">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/60">Payment complete</div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            You’re set — {pretty} is active.
          </h1>

          <p className="mt-3 text-sm text-white/70">
            If Billing doesn’t update immediately, refresh once. (Subscriptions are applied by webhook.)
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/settings/billing?success=1"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Go to Billing
            </Link>

            <Link
              href="/app/dashboard"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Go to Dashboard
            </Link>
          </div>

          <div className="mt-4 text-[11px] text-white/40">
            Success URL: /pricing/success{plan ? `?plan=${encodeURIComponent(plan)}` : ""}
          </div>
        </div>
      </div>
    </main>
  );
}