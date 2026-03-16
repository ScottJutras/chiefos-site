"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  onAsk?: (query: string) => void;
  placeholder?: string;
  buttonLabel?: string;
};

export default function AskChiefMini({
  onAsk,
  placeholder = 'e.g., "Did Medway Park make money (WTD)?"',
  buttonLabel = "Ask",
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (onAsk) {
      onAsk(trimmed);
      setQ("");
      return;
    }

    router.push(`/app/chief?q=${encodeURIComponent(trimmed)}`);
    setQ("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor="ask-chief-mini" className="sr-only">
        Ask Chief
      </label>

      <input
        id="ask-chief-mini"
        name="askChief"
        type="text"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
      />

      <button
        type="submit"
        disabled={!q.trim()}
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </form>
  );
}