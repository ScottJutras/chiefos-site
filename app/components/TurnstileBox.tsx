"use client";

import { useEffect, useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

export default function TurnstileBox(props: {
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const { onToken, resetKey = 0 } = props;

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const [mounted, setMounted] = useState(false);

  // stable options to avoid re-init loops
  const options = useMemo(() => ({ appearance: "always" as const }), []);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (!siteKey) {
    return (
      <div className="text-xs text-red-600">
        Turnstile misconfigured: missing NEXT_PUBLIC_TURNSTILE_SITE_KEY
      </div>
    );
  }

  return (
    <Turnstile
      key={resetKey}
      siteKey={siteKey}
      options={options}
      onSuccess={(t) => onToken(t)}
      onExpire={() => onToken(null)}
      onError={() => onToken(null)}
    />
  );
}