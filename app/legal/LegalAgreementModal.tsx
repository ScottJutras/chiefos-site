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

      <div className="absolute inset-x-4 top-1/2 mx-auto flex w-full max-w-5xl -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-[rgba(212,168,83,0.2)] bg-[#0C0B0A] text-[#E8E2D8] shadow-[0_50px_160px_rgba(0,0,0,0.75)]" style={{ maxHeight: "calc(100vh - 2rem)" }}>
        <div className="border-b border-[rgba(212,168,83,0.15)] bg-[rgba(212,168,83,0.04)] px-5 py-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs tracking-[0.18em] uppercase text-[#706A60]">
                Review before creating your account
              </div>
              <h2 className="mt-2 text-xl md:text-2xl font-semibold text-[#E8E2D8]">
                Terms and Agreement Review
              </h2>
              <p className="mt-2 text-sm text-[#A8A090] max-w-2xl leading-relaxed">
                Please review the terms, privacy policy, AI usage policy, and data processing agreement.
                Scroll to the bottom to enable acceptance.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-3 py-2 text-xs font-semibold text-[#A8A090] hover:text-[#D4A853] transition"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <a
              href="#terms"
              className="rounded-full border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-3 py-1 text-[#A8A090] hover:text-[#D4A853] transition"
            >
              Terms
            </a>
            <a
              href="#privacy"
              className="rounded-full border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-3 py-1 text-[#A8A090] hover:text-[#D4A853] transition"
            >
              Privacy
            </a>
            <a
              href="#ai-policy"
              className="rounded-full border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-3 py-1 text-[#A8A090] hover:text-[#D4A853] transition"
            >
              AI Policy
            </a>
            <a
              href="#dpa"
              className="rounded-full border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.06)] px-3 py-1 text-[#A8A090] hover:text-[#D4A853] transition"
            >
              DPA
            </a>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <LegalAgreementContent />
        </div>

        <div className="border-t border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] px-5 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canCheck}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[rgba(212,168,83,0.3)] bg-[#0C0B0A] accent-[#D4A853] disabled:opacity-50"
                />
                <span className="text-sm text-[#A8A090] leading-relaxed">
                  I have reviewed the Terms and Agreement and agree to the Terms of Service,
                  Privacy Policy, AI Usage Policy, and Data Processing Agreement.
                </span>
              </label>

              {!canCheck ? (
                <div className="mt-2 text-xs text-[#D4A853]/70">
                  Scroll to the bottom of the document to enable acceptance.
                </div>
              ) : (
                <div className="mt-2 text-xs text-[#706A60]">
                  You’ve reached the end. You can now accept and continue.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] px-5 py-3 text-sm font-semibold text-[#A8A090] hover:text-[#D4A853] hover:border-[rgba(212,168,83,0.5)] transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={acceptDisabled}
                onClick={onAccept}
                className="inline-flex items-center justify-center rounded-[2px] bg-[#D4A853] px-5 py-3 text-sm font-semibold text-[#0C0B0A] hover:bg-[#C49843] transition disabled:opacity-50"
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