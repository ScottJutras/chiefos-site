"use client";

import * as React from "react";

type Variant = "default" | "wide";

type Tier = {
  id: "starter" | "pro";
  name: string;
  priceMonthly: number;
  note?: string;
};

type StackItem = {
  name: string;
  typicalLabel: string;
  base?: number;
  perSeat?: number;
  appliesSeats?: boolean;
  isTimeCost?: boolean;
  footnote?: string;
};

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function StackVsChief({ variant = "default" }: { variant?: Variant }) {
  // ✅ Put your real tier prices here
  const TIERS: Tier[] = [
    { id: "starter", name: "Starter", priceMonthly: 79, note: "Core tools + Chief" },
    { id: "pro", name: "Pro", priceMonthly: 149, note: "More volume + advanced workflows" },
  ];

  const [tier, setTier] = React.useState<Tier>(TIERS[0]);
  const [teamSize, setTeamSize] = React.useState<number>(3);

  // Illustrative time cost (toggleable)
  const [includeTimeCost, setIncludeTimeCost] = React.useState<boolean>(true);

  const ownerHourly = 50;
  const spreadsheetHoursPerWeek = 4;
  const weeksPerMonth = 4.33;

  const STACK: StackItem[] = [
    { name: "Time tracking", typicalLabel: "$20 base + $8/user/mo", base: 20, perSeat: 8, appliesSeats: true },
    { name: "Receipt capture", typicalLabel: "$5/user/mo", perSeat: 5, appliesSeats: true },
    { name: "CRM", typicalLabel: "$15/user/mo", perSeat: 15, appliesSeats: true },
    { name: "Accounting", typicalLabel: "$35–$90/mo", base: 60, appliesSeats: false },
    { name: "Notes / misc", typicalLabel: "$0 (but fragmented)", base: 0, appliesSeats: false },
    {
      name: "Spreadsheet rebuild",
      typicalLabel: "3–6 hrs/week (owner time)",
      base: Math.round(ownerHourly * spreadsheetHoursPerWeek * weeksPerMonth),
      appliesSeats: false,
      isTimeCost: true,
      footnote: "Illustrative time cost — not software spend",
    },
  ];

  const stackTotal = STACK.reduce((sum, x) => {
    if (x.isTimeCost && !includeTimeCost) return sum;
    const seats = x.appliesSeats ? teamSize : 0;
    const perSeatCost = x.perSeat ? x.perSeat * seats : 0;
    const base = x.base ?? 0;
    return sum + base + perSeatCost;
  }, 0);

  const chiefTotal = tier.priceMonthly;
  const savings = stackTotal - chiefTotal;

  const wrapCls =
    variant === "wide"
      ? "rounded-3xl border border-white/15 bg-white/[0.05] p-7 md:p-10 text-left shadow-[0_40px_140px_rgba(255,255,255,0.08)] ring-1 ring-white/10"
      : "rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left";

  return (
    <div className={wrapCls}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div>
          <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Comparison</div>
          <div className="mt-2 text-2xl md:text-3xl font-semibold text-white leading-tight">
            Stack of apps vs ChiefOS
          </div>
          <div className="mt-2 text-sm md:text-base text-white/60 max-w-2xl">
            Choose team size. The stack adds base fees + per-seat pricing. ChiefOS stays one price per tier.
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 min-w-[260px]">
          <div className="flex gap-2">
            {TIERS.map((t) => {
              const active = t.id === tier.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t)}
                  className={[
                    "flex-1 rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "border-white/25 bg-white/[0.10] text-white"
                      : "border-white/10 bg-black/20 text-white/75 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {t.name}
                  <div className="text-xs font-medium text-white/70 mt-0.5">
                    ${money(t.priceMonthly)}/mo
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="text-sm text-white/70">Team size</div>
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85"
            >
              {[1, 2, 3, 5, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "person" : "people"}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 cursor-pointer">
            <span className="text-sm text-white/70">Include labour cost of spreadsheet creation  </span>
            <input
  type="checkbox"
  checked={includeTimeCost}
  onChange={(e) => setIncludeTimeCost(e.target.checked)}
  className="
  h-5 w-5
  rounded-md
  border border-white/30
  bg-black/40
  accent-black
  focus:ring-2 focus:ring-white/30
  cursor-pointer
"
/>
          </label>
        </div>
      </div>

      {/* Chart-style rows */}
      <div className="mt-8 grid gap-2">
        <div className="grid grid-cols-12 gap-3 px-2 text-xs text-white/50 tracking-[0.16em] uppercase">
          <div className="col-span-5">Category</div>
          <div className="col-span-4 text-right">Typical pricing</div>
          <div className="col-span-3 text-right">Estimated cost</div>
        </div>

        {STACK.filter((x) => includeTimeCost || !x.isTimeCost).map((x) => {
          const seats = x.appliesSeats ? teamSize : 0;
          const perSeatCost = x.perSeat ? x.perSeat * seats : 0;
          const base = x.base ?? 0;
          const est = base + perSeatCost;

          return (
            <div
              key={x.name}
              className="grid grid-cols-12 gap-3 items-start rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
            >
              <div className="col-span-5 text-white/85">
                {x.name}
                {x.footnote ? <div className="mt-1 text-xs text-white/45">{x.footnote}</div> : null}
              </div>

              <div className="col-span-4 text-right">
                <div className="text-white/80">{x.typicalLabel}</div>
                {x.appliesSeats && x.perSeat != null ? (
                  <div className="text-xs text-white/50">Per seat: ${x.perSeat}/user/mo</div>
                ) : (
                  <div className="text-xs text-white/50">&nbsp;</div>
                )}
              </div>

              <div className="col-span-3 text-right text-white font-semibold">
                ${money(est)}/mo
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="mt-6 grid md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
          <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Stack total</div>
          <div className="mt-2 text-2xl font-semibold text-white">${money(stackTotal)}/mo</div>
          <div className="mt-1 text-xs text-white/45">Base fees + per-seat add-ons</div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/35 px-5 py-4 ring-1 ring-white/10">
          <div className="text-xs text-white/55 tracking-[0.16em] uppercase">ChiefOS</div>
          <div className="mt-2 text-2xl font-semibold text-white">${money(chiefTotal)}/mo</div>
          <div className="mt-1 text-xs text-white/45">
            {tier.name} — {tier.note}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
          <div className="text-xs text-white/55 tracking-[0.16em] uppercase">Difference</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {savings >= 0 ? `Save ~$${money(savings)}/mo` : `+~$${money(Math.abs(savings))}/mo`}
          </div>
          <div className="mt-1 text-xs text-white/45">
            Estimates vary by vendor and workflow
          </div>
        </div>
      </div>
    </div>
  );
}