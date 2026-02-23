"use client";

import { useEffect, useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

export default function TurnstileBox(props: {
  onToken: (token: string | null) => void;
  resetKey?: number;
  className?: string;
}) {
  const { onToken, resetKey = 0, className } = props;

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // This internal key is what forces the widget to fully remount.
  // We combine resetKey + siteKey so changing either reinitializes deterministically.
  const widgetKey = useMemo(() => `${resetKey}:${siteKey}`, [resetKey, siteKey]);

  const [mounted, setMounted] = useState(false);

  // Avoid hydration weirdness / flicker caused by rendering Turnstile before client mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // If key missing or not mounted yet, ensure the parent doesn't keep a stale token.
  useEffect(() => {
    if (!mounted || !siteKey) onToken(null);
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
        onSuccess={(token) => onToken(token || null)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
        options={{
          appearance: "always",
        }}
      />
    </div>
  );
}