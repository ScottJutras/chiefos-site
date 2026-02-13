// app/components/Toast.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; message: string; kind?: "info" | "error" | "success" };

const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

function tone(kind?: Toast["kind"]) {
  if (kind === "error") return "border-red-200 bg-red-50 text-red-900";
  if (kind === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-black/10 bg-white text-black";
}

function badge(kind?: Toast["kind"]) {
  if (kind === "error") return "Error";
  if (kind === "success") return "Done";
  return "Note";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, ...t };
    setItems((p) => [...p, toast]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 2800);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}

      <div className="fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              "w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-[0_18px_60px_rgba(0,0,0,0.12)]",
              "backdrop-blur-xl",
              tone(t.kind),
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs tracking-[0.16em] uppercase opacity-70">{badge(t.kind)}</div>
                <div className="mt-1 text-sm font-medium">{t.message}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}
