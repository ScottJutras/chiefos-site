"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function AskChiefMini() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const prompts = useMemo(
    () => [
      "What did I spend this week?",
      "Show unassigned expenses.",
      "Which job is losing money (MTD)?",
    ],
    []
  );

  function go(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    // We route to /app/chief and prefill via querystring (Phase 1).
    // Chief page can optionally read this later; even if it doesn’t, this still works as a fast deep-link.
    router.push(`/app/chief?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white/90">Ask Chief</div>
          <div className="mt-1 text-sm text-white/60">
            Answers are grounded in your logged ledger — with scope and evidence.
          </div>
        </div>

        <a
          href="/app/chief"
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          Open Chief →
        </a>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='e.g., "Did Medway Park make money (WTD)?"'
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
        />
        <button
          type="button"
          onClick={() => go(q)}
          disabled={!q.trim()}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
        >
          Ask
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 transition"
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}
