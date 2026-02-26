"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AskChiefMini() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Phase 1 behavior (no overhaul): still uses Chief page to run the query.
    // Dashboard remains the "Decision Centre" surface; commands live on the right.
    router.push(`/app/chief?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="text-xs text-white/55">Ask Chief</div>
      <div className="mt-1 text-sm text-white/65">
        Ask about spend, revenue, profit, jobs — Chief answers from your ledger.
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
      >
        <div className="flex gap-2">
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
            placeholder='e.g., "Did Medway Park make money (WTD)?"'
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/15"
          />

          <button
            type="submit"
            disabled={!q.trim()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
          >
            Ask
          </button>
        </div>

        <div className="mt-2 text-[11px] text-white/45">
          Tip: use the command panel on the right for copy/paste prompts.
        </div>
      </form>
    </section>
  );
}