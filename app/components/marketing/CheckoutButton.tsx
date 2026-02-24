"use client";

import { useState } from "react";

export default function CheckoutButton({
  plan,
  phone,
  children = "Get it now",
  className = "",
}: {
  plan: "starter" | "pro";
  phone?: string; // optional phone for linking
  children?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      className={className}
      onClick={async () => {
        try {
          setLoading(true);

          const r = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan, phone }),
          });

          const j = await r.json();
          if (!j?.ok || !j?.url) throw new Error(j?.message || "Checkout failed");

          window.location.href = j.url;
        } catch (err: any) {
          alert(err?.message || "Checkout failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Redirecting…" : children}
    </button>
  );
}