"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LegalAgreementContent from "@/app/legal/LegalAgreementContent";

type Props = {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  accepted?: boolean;
};

export default function LegalAgreementModal({
  open,
  onClose,
  onAccept,
  accepted = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canCheck, setCanCheck] = useState(false);
  const [checked, setChecked] = useState(accepted);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCanCheck(false);
      setChecked(accepted);
      return;
    }

    function handleScroll() {
      const el = scrollRef.current;
      if (!el) return;

      const threshold = 24;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      if (atBottom) setCanCheck(true);
    }

    handleScroll();

    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [open, accepted]);

  const acceptDisabled = useMemo(() => !canCheck || !checked, [canCheck, checked]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="absolute inset-x-4 top-1/2 mx-auto w-full max-w-5xl -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/10 bg-[#070707] text-white shadow-[0_50px_160px_rgba(0,0,0,0.75)]">
        <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs tracking-[0.18em] uppercase text-white/45">
                Review before creating your account
              </div>
              <h2 className="mt-2 text-xl md:text-2xl font-semibold text-white/95">
                ChiefOS legal agreement package
              </h2>
              <p className="mt-2 text-sm text-white/65 max-w-2xl leading-relaxed">
                Please review the terms, privacy policy, AI usage policy, and data processing agreement.
                Scroll to the bottom to enable acceptance.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <a
              href="#terms"
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70 hover:bg-white/10"
            >
              Terms
            </a>
            <a
              href="#privacy"
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70 hover:bg-white/10"
            >
              Privacy
            </a>
            <a
              href="#ai-policy"
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70 hover:bg-white/10"
            >
              AI Policy
            </a>
            <a
              href="#dpa"
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-white/70 hover:bg-white/10"
            >
              DPA
            </a>
          </div>
        </div>

        <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto px-5 py-5 md:px-6">
          <LegalAgreementContent />
        </div>

        <div className="border-t border-white/10 bg-black/80 px-5 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canCheck}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-black text-white disabled:opacity-50"
                />
                <span className="text-sm text-white/75 leading-relaxed">
                  I have reviewed the legal agreement package and agree to the Terms of Service,
                  Privacy Policy, AI Usage Policy, and Data Processing Agreement.
                </span>
              </label>

              {!canCheck ? (
                <div className="mt-2 text-xs text-amber-200/80">
                  Scroll to the bottom of the document to enable acceptance.
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/45">
                  You’ve reached the end. You can now accept and continue.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={acceptDisabled}
                onClick={onAccept}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition disabled:opacity-50"
              >
                Accept and continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}