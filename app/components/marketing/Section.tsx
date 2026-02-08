// app/components/marketing/Section.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * High-end "scene reveal" without being over the top:
 * - intersection observer triggers once
 * - subtle translate + fade
 * - respects prefers-reduced-motion
 */
export default function Section({
  id,
  className,
  children,
  reveal = true,
  revealDelayMs = 0,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  reveal?: boolean;
  revealDelayMs?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(!reveal);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }, []);

  useEffect(() => {
    if (!reveal || prefersReducedMotion) {
      setSeen(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setTimeout(() => setSeen(true), revealDelayMs);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [reveal, prefersReducedMotion, revealDelayMs]);

  return (
    <section
      id={id}
      ref={ref}
      className={[
        className || "",
        reveal
          ? [
              "transition-all duration-500 ease-out",
              prefersReducedMotion ? "" : "motion-safe:will-change-transform",
              seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
            ].join(" ")
          : "",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}
