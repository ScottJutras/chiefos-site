"use client";

import Link from "next/link";

type Props = {
  featureName: string;
  availableOn?: string;
  upgradeUrl?: string;
  variant?: "banner" | "overlay";
  freeNote?: string;
};

export default function PlanGateBanner({
  featureName,
  availableOn = "Starter and Pro",
  upgradeUrl = "/app/settings/billing",
  variant = "banner",
  freeNote,
}: Props) {
  if (variant === "overlay") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-[24px] border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-8 py-10 max-w-sm w-full">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.08)]">
            <svg className="h-5 w-5 text-[#D4A853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-white/90">{featureName}</h2>
          <p className="mt-2 text-sm text-white/50">
            Available on {availableOn} plans.
          </p>
          <div className="mt-6">
            <Link
              href={upgradeUrl}
              className="inline-flex items-center justify-center rounded-xl bg-[#D4A853] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#C49843] transition"
            >
              View Plans →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="h-4 w-4 shrink-0 text-[#D4A853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div className="min-w-0">
          <span className="text-sm font-medium text-[#D4A853]">
            {featureName} is available on {availableOn}.
          </span>
          {freeNote && (
            <span className="ml-1 text-xs text-white/45">{freeNote}</span>
          )}
        </div>
      </div>
      <Link
        href={upgradeUrl}
        className="shrink-0 inline-flex items-center rounded-xl border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.1)] px-3 py-1.5 text-xs font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition"
      >
        View Plans →
      </Link>
    </div>
  );
}
