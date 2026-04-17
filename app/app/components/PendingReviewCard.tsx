"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type PendingItem = {
  id: string;
  log_no: number | null;
  type: string;
  content: string | null;
  created_by_name: string | null;
  created_at: string;
  status: string;
};

async function authedFetch(path: string) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("no-session");
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } });
}

export default function PendingReviewCard() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await authedFetch("/api/crew/review/inbox");
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && Array.isArray(j.items)) {
          const pending = j.items.filter((i: any) => i.status === "submitted");
          setItems(pending.slice(0, 5) as PendingItem[]);
        }
      } catch {
        // fail-soft
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading || items.length === 0) return null;

  const typeLabel = (t: string) => {
    switch (t) {
      case "time": return "Time";
      case "expense": return "Expense";
      case "revenue": return "Revenue";
      case "task": return "Task";
      default: return t;
    }
  };

  const typeColor = (t: string) => {
    switch (t) {
      case "expense": return "bg-red-500/20 text-red-400";
      case "revenue": return "bg-emerald-500/20 text-emerald-400";
      case "time": return "bg-blue-500/20 text-blue-400";
      default: return "bg-white/10 text-white/60";
    }
  };

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">Needs your review</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-400">
            {items.length}
          </span>
        </div>
        <Link href="/app/crew/inbox" className="text-[10px] text-amber-400/50 hover:text-amber-400/80 transition">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href="/app/crew/inbox"
            className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 hover:bg-black/30 transition"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={["rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase", typeColor(item.type)].join(" ")}>
                  {typeLabel(item.type)}
                </span>
                <span className="truncate text-sm text-white/80">
                  {item.created_by_name || "Employee"}
                </span>
              </div>
              {item.content && (
                <div className="mt-0.5 truncate text-xs text-white/40">{item.content}</div>
              )}
            </div>
            <span className="shrink-0 text-white/20 text-xs ml-2">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
