"use client";

import { ReactNode, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;

  // ✅ NEW
  busy?: boolean;      // prevents closing while saving
  closeOnBackdrop?: boolean; // default true
  closeOnEsc?: boolean;      // default true
};

export default function Slideover({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  busy = false,
  closeOnBackdrop = true,
  closeOnEsc = true,
}: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (!open) return;
      if (!closeOnEsc) return;
      if (busy) return;
      if (e.key === "Escape") onClose();
    }

    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose, busy, closeOnEsc]);

  // ✅ body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!closeOnBackdrop) return;
          if (busy) return;
          onClose();
        }}
      />

      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-xl bg-black border-l border-white/10 shadow-[0_40px_140px_rgba(0,0,0,0.8)] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-white/50">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/80 backdrop-blur">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
