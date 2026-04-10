"use client";

/**
 * OnboardingWidget — compact 3-step progress card shown on the dashboard
 * until setup is complete or the user dismisses it.
 *
 * Steps:
 *   1. Account created  — always done
 *   2. WhatsApp linked  — driven by hasWhatsApp prop; skippable
 *   3. First expense    — driven by hasData prop (≥1 transaction); skippable
 *
 * Skip state persists in localStorage so it survives page refreshes without
 * needing a backend round-trip.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

const WA_NUMBER   = "12316802664";
const DISMISS_KEY = "chiefos:onboarding_widget_dismissed";
const SKIP_WA_KEY = "chiefos:onboarding_skip_whatsapp";
const SKIP_EX_KEY = "chiefos:onboarding_skip_expense";

function getLocal(key: string) {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key) === "1";
}
function setLocal(key: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, "1");
}

function StepRow({
  done,
  skipped,
  label,
  sub,
  action,
  onSkip,
}: {
  done: boolean;
  skipped: boolean;
  label: string;
  sub: string;
  action?: React.ReactNode;
  onSkip?: () => void;
}) {
  const isDimmed = done || skipped;

  return (
    <div className="flex items-start gap-3">
      {/* Status dot */}
      <div className="mt-0.5 shrink-0">
        {done ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : skipped ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
            <div className="h-1.5 w-3 rounded-full bg-white/20" />
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/20 bg-white/5">
            <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={["text-xs font-medium", isDimmed ? "text-white/40" : "text-white/85"].join(" ")}>
          {label}
          {skipped && <span className="ml-2 text-[10px] text-white/25 font-normal">skipped</span>}
        </div>
        {!isDimmed && <div className="text-[11px] text-white/35 leading-relaxed mt-0.5">{sub}</div>}
        {!isDimmed && action && <div className="mt-2">{action}</div>}
        {!isDimmed && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-1 text-[10px] text-white/25 hover:text-white/45 transition"
          >
            Skip this step
          </button>
        )}
      </div>
    </div>
  );
}

export default function OnboardingWidget({
  hasWhatsApp,
  hasData,
}: {
  hasWhatsApp: boolean;
  hasData: boolean;
}) {
  const [mounted, setMounted]     = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [skipWa, setSkipWa]       = useState(false);
  const [skipEx, setSkipEx]       = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(getLocal(DISMISS_KEY));
    setSkipWa(getLocal(SKIP_WA_KEY));
    setSkipEx(getLocal(SKIP_EX_KEY));
  }, []);

  const allDone = hasWhatsApp && hasData;

  // Hide if dismissed, all done, or not yet mounted (avoids SSR mismatch)
  if (!mounted || dismissed || allDone) return null;

  // Also hide if both non-done steps are skipped
  if (!hasWhatsApp && skipWa && !hasData && skipEx) return null;

  function dismiss() {
    setLocal(DISMISS_KEY);
    setDismissed(true);
  }

  const stepsComplete = 1 + (hasWhatsApp ? 1 : 0) + (hasData ? 1 : 0);

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white/80">Getting started</div>
          <div className="text-[11px] text-white/35 mt-0.5">{stepsComplete} of 3 steps complete</div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-[10px] text-white/25 hover:text-white/50 transition shrink-0"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-white/8">
        <div
          className="h-1 rounded-full bg-emerald-500/60 transition-all"
          style={{ width: `${Math.round((stepsComplete / 3) * 100)}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <StepRow
          done={true}
          skipped={false}
          label="Account created"
          sub="Your workspace is ready."
        />
        <StepRow
          done={hasWhatsApp}
          skipped={skipWa}
          label="Link WhatsApp"
          sub="Connect your phone so Chief knows it's you."
          onSkip={() => { setLocal(SKIP_WA_KEY); setSkipWa(true); }}
          action={
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("LINK")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-white/90 transition"
              >
                Open WhatsApp
              </a>
              <Link
                href="/app/welcome"
                className="inline-flex items-center rounded-xl border border-white/15 px-3 py-1.5 text-[11px] text-white/60 hover:bg-white/5 transition"
              >
                Show link code
              </Link>
            </div>
          }
        />
        <StepRow
          done={hasData}
          skipped={skipEx}
          label="Log your first expense"
          sub="Text Chief: expense $150 Home Depot"
          onSkip={() => { setLocal(SKIP_EX_KEY); setSkipEx(true); }}
          action={
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("expense $150 Home Depot")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-white/90 transition"
            >
              Try in WhatsApp
            </a>
          }
        />
      </div>
    </div>
  );
}
