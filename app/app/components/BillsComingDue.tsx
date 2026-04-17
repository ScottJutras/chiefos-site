"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Bill = {
  id: string;
  name: string;
  amount_cents: number;
  tax_amount_cents: number | null;
  category: string;
  due_day: number | null;
  next_due_at: string | null;
  frequency: string;
};

type BillWithDays = Bill & { daysUntil: number; totalCents: number };

function computeNextDue(bill: Bill): BillWithDays | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextDate: Date | null = null;

  if (bill.next_due_at) {
    nextDate = new Date(bill.next_due_at + "T00:00:00");
  } else if (bill.due_day) {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), bill.due_day);
    nextDate = thisMonth >= today ? thisMonth : new Date(now.getFullYear(), now.getMonth() + 1, bill.due_day);
  }

  if (!nextDate || isNaN(nextDate.getTime())) return null;

  const diffMs = nextDate.getTime() - today.getTime();
  const daysUntil = Math.round(diffMs / 86400000);
  const totalCents = bill.amount_cents + (bill.tax_amount_cents || 0);

  return { ...bill, daysUntil, totalCents };
}

function fmtMoney(cents: number) {
  return "$" + (Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const categoryIcons: Record<string, string> = {
  facility: "🏢", vehicle: "🚛", equipment: "🔧",
  insurance: "🛡️", payroll: "💰", other: "📋",
};

export default function BillsComingDue() {
  const [bills, setBills] = useState<BillWithDays[]>([]);
  const [monthNetCents, setMonthNetCents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

        const [{ data: ohData }, { data: txData }] = await Promise.all([
          supabase
            .from("overhead_items")
            .select("id, name, amount_cents, tax_amount_cents, category, due_day, next_due_at, frequency, item_type")
            .eq("active", true)
            .eq("item_type", "recurring"),
          supabase
            .from("transactions")
            .select("amount_cents, kind")
            .gte("date", monthStart)
            .in("kind", ["revenue", "expense"]),
        ]);

        if (!alive) return;

        // Compute net profit this month
        let rev = 0, exp = 0;
        for (const t of (txData || []) as any[]) {
          if (t.kind === "revenue") rev += Number(t.amount_cents || 0);
          else if (t.kind === "expense") exp += Number(t.amount_cents || 0);
        }
        setMonthNetCents(rev - exp);

        const withDays = (ohData || [])
          .map((b: any) => computeNextDue(b as Bill))
          .filter((b): b is BillWithDays => b !== null)
          .sort((a, b) => a.daysUntil - b.daysUntil);

        setBills(withDays);
      } catch {
        // fail-soft
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading || bills.length === 0) return null;

  // Bills due in the next 30 days
  const upcoming = bills.filter((b) => b.daysUntil <= 30);
  const totalDueCents = upcoming.reduce((sum, b) => sum + b.totalCents, 0);
  const shortfall = totalDueCents - Math.max(monthNetCents, 0);
  const covered = monthNetCents >= totalDueCents;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Bills &amp; overhead</span>
        <Link href="/app/overhead" className="text-[10px] text-white/30 hover:text-white/50 transition">Manage →</Link>
      </div>

      {/* Break-even summary */}
      <div className={[
        "rounded-xl px-4 py-3 mb-3",
        covered ? "border border-emerald-500/20 bg-emerald-500/[0.06]" : "border border-amber-500/25 bg-amber-500/[0.07]",
      ].join(" ")}>
        <div className="text-sm text-white/80">
          <span className="font-semibold">{upcoming.length} bill{upcoming.length !== 1 ? "s" : ""}</span>
          {" "}due this month totaling{" "}
          <span className="font-semibold">{fmtMoney(totalDueCents)}</span>
        </div>
        <div className={["mt-1 text-xs", covered ? "text-emerald-400" : "text-amber-400"].join(" ")}>
          {covered
            ? `Covered — net profit this month is ${fmtMoney(monthNetCents)}`
            : `You need ${fmtMoney(shortfall)} more in net profit to cover these`
          }
        </div>
      </div>

      {/* Individual bills */}
      <div className="space-y-2">
        {upcoming.slice(0, 6).map((b) => {
          const isOverdue = b.daysUntil < 0;
          const isUrgent = b.daysUntil >= 0 && b.daysUntil <= 7;

          return (
            <div
              key={b.id}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2.5",
                isOverdue ? "border border-red-500/30 bg-red-500/10"
                  : isUrgent ? "border border-amber-500/25 bg-amber-500/[0.07]"
                  : "border border-white/8 bg-black/20",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">{categoryIcons[b.category] || "📋"}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/85">{b.name}</div>
                  <div className="text-[10px] text-white/40 capitalize">{b.category} · {b.frequency}</div>
                </div>
              </div>
              <div className="shrink-0 text-right ml-3">
                <div className="text-sm font-semibold tabular-nums text-white/85">{fmtMoney(b.totalCents)}</div>
                <div className={[
                  "text-[10px] font-medium",
                  isOverdue ? "text-red-400" : isUrgent ? "text-amber-400" : "text-white/40",
                ].join(" ")}>
                  {isOverdue ? `${Math.abs(b.daysUntil)}d overdue` : b.daysUntil === 0 ? "Due today" : `${b.daysUntil}d`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
