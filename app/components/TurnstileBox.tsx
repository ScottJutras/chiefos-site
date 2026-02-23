"use client";

import { useEffect, useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

export default function TurnstileBox(props: {
  onToken: (token: string | null) => void;
  /** Bump this to force a new widget (only when you *want* to reset) */
  resetKey?: number;
  className?: string;
}) {
  const { onToken, resetKey = 0, className } = props;

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const [mounted, setMounted] = useState(false);

  // ✅ Stable options object (prevents remount loops)
  const options = useMemo(() => ({ appearance: "always" as const }), []);

  // ✅ Deterministic widget key: only changes when YOU bump resetKey or siteKey changes
  const widgetKey = useMemo(() => `${resetKey}:${siteKey}`, [resetKey, siteKey]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ Clear stale token if we can't render Turnstile
  useEffect(() => {
    if (!mounted || !siteKey) onToken(null);
    // Intentionally omit onToken from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, siteKey, resetKey]);

  if (!mounted) {
    return (
      <div className={className}>
        <div className="rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-xs text-black/70">
          Loading bot check…
        </div>
      </div>
    );
  }

  if (!siteKey) {
    return (
      <div className={className}>
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Turnstile misconfigured: missing <b>NEXT_PUBLIC_TURNSTILE_SITE_KEY</b>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Turnstile
        key={widgetKey}
        siteKey={siteKey}
        options={options}
        onSuccess={(t) => onToken(t || null)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
}