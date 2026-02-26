"use client";

import Link from "next/link";

type ViewKey = "expenses" | "revenue" | "time" | "tasks";

export default function DecisionCenterNav({
  view,
  setView,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
}) {
  const pill = (active: boolean) =>
    [
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active
        ? "border-white/20 bg-white/10 text-white"
        : "border-white/10 bg-black/30 text-white/70 hover:bg-white/5 hover:text-white/85",
    ].join(" ");

  const sep = <span className="mx-1 text-white/25">|</span>;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className={pill(view === "expenses")} onClick={() => setView("expenses")}>
        Expenses
      </button>
      <button type="button" className={pill(view === "revenue")} onClick={() => setView("revenue")}>
        Revenue
      </button>
      <button type="button" className={pill(view === "time")} onClick={() => setView("time")}>
        Time
      </button>
      <button type="button" className={pill(view === "tasks")} onClick={() => setView("tasks")}>
        Tasks
      </button>

      {sep}

      {/* Commands are already on the dashboard — this just jumps there */}
      <a href="#command-reference" className={pill(false)}>
        Commands
      </a>

      {/* These can remain links for now (or convert to drawers later) */}
      <Link href="/app/settings/billing" className={pill(false)}>
        Billing
      </Link>
      <Link href="/app/settings" className={pill(false)}>
        Settings
      </Link>
    </div>
  );
}