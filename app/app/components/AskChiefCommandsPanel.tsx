// chiefos-site/app/app/components/AskChiefCommandsPanel.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ASK_CHIEF_GROUPS, type PromptGroup } from "@/lib/askChiefPrompts";

function copy(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function badgeClass(status?: PromptGroup["status"]) {
  switch (status) {
    case "Works now":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "Target next":
      return "border-amber-400/20 bg-amber-500/10 text-amber-200";
    case "Should gate on Free":
      return "border-sky-400/20 bg-sky-500/10 text-sky-200";
    case "Not supported":
      return "border-white/10 bg-white/5 text-white/55";
    default:
      return "border-white/10 bg-white/5 text-white/55";
  }
}

export default function AskChiefCommandsPanel(props: { maxHeightClassName?: string }) {
  const [q, setQ] = useState("");
  const maxH = props.maxHeightClassName ?? "max-h-[70vh]";

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ASK_CHIEF_GROUPS;

    return ASK_CHIEF_GROUPS
      .map((g) => {
        const prompts = g.prompts.filter((p) => p.toLowerCase().includes(needle));
        const hit =
          g.title.toLowerCase().includes(needle) ||
          (g.subtitle || "").toLowerCase().includes(needle) ||
          prompts.length > 0;

        return hit ? { ...g, prompts } : null;
      })
      .filter(Boolean) as PromptGroup[];
  }, [q]);

  return (
    <aside className="rounded-2xl border border-white/10 bg-black/30">
      {/* Header */}
      <div className="sticky top-0 z-10 rounded-t-2xl border-b border-white/10 bg-black/60 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/55">Ask Chief</div>
            <div className="mt-1 text-sm font-semibold text-white/90">
              Prompts that work (and what’s next)
            </div>
            <div className="mt-1 text-xs text-white/55">
              Copy/paste questions. Status labels prevent accidental promises.
            </div>
          </div>
        </div>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: profit, spend, job, hours, cash…"
            className={[
              "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm",
              "text-white/85 placeholder:text-white/35 outline-none",
              "focus:border-white/20",
            ].join(" ")}
          />
        </div>
      </div>

      {/* Body */}
      <div className={`${maxH} overflow-auto p-4`}>
        <div className="space-y-4">
          {filtered.map((g, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">{g.title}</div>
                  {g.subtitle ? (
                    <div className="mt-0.5 text-xs text-white/55">{g.subtitle}</div>
                  ) : null}
                </div>

                {g.status ? (
                  <span
                    className={[
                      "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
                      badgeClass(g.status),
                    ].join(" ")}
                  >
                    {g.status}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {g.prompts.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <code className="min-w-0 text-[12px] text-white/80 break-words">{p}</code>
                    <button
                      onClick={() => copy(p)}
                      className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/75 hover:bg-white/10 transition"
                    >
                      Copy
                    </button>
                  </div>
                ))}

                {g.notes?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/55">
                    {g.notes.map((n, j) => (
                      <li key={j}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}

          {!filtered.length ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/60">
              No matches. Try “profit”, “spend”, “job”, “hours”, “cash”.
            </div>
          ) : null}

          {/* Trust-first footer */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/55">
            Chief will not invent numbers. If something can’t be computed yet, it should say what’s missing and what it
            can answer right now.
          </div>
        </div>
      </div>
    </aside>
  );
}