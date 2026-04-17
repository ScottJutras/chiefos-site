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

type BillWithDays = Bill & { daysUntil: number; nextDate: string };

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

  return {
    ...bill,
    daysUntil,
    nextDate: nextDate.toISOString().slice(0, 10),
  };
}

function fmtMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const categoryIcons: Record<string, string> = {
  facility: "🏢",
  vehicle: "🚛",
  equipment: "🔧",
  insurance: "🛡️",
  payroll: "💰",
  other: "📋",
};

export default function BillsComingDue() {
  const [bills, setBills] = useState<BillWithDays[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("overhead_items")
          .select("id, name, amount_cents, tax_amount_cents, category, due_day, next_due_at, frequency")
          .eq("active", true)
          .eq("item_type", "recurring");

        if (!alive) return;

        const withDays = (data || [])
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

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Bills coming due</span>
        </div>
        <Link href="/app/overhead" className="text-[10px] text-white/30 hover:text-white/50 transition">
          Manage →
        </Link>
      </div>
      <div className="space-y-2">
        {bills.slice(0, 6).map((b) => {
          const isOverdue = b.daysUntil < 0;
          const isUrgent = b.daysUntil >= 0 && b.daysUntil <= 7;
          const total = b.amount_cents + (b.tax_amount_cents || 0);

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
                <div className="text-sm font-semibold tabular-nums text-white/85">{fmtMoney(total)}</div>
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
