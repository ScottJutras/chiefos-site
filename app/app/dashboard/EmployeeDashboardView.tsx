"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";

type HoursSummary = { totalHours: number; shiftCount: number; daysWorked: number } | null;
type MileageSummary = { distance: number; unit: string; trips: number } | null;
type TaskRow = { title: string; due_date: string | null; status: string | null };
type SubmissionRow = { id: number; title: string | null; created_at: string | null; status: string | null };

function startOfWeekUTC(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

function startOfWeekDateStr(): string {
  return startOfWeekUTC().slice(0, 10);
}

export default function EmployeeDashboardView() {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [hours, setHours] = useState<HoursSummary>(null);
  const [mileage, setMileage] = useState<MileageSummary>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const w = await fetchWhoami();
        if (!w?.ok || !w.tenantId) {
          if (alive) setLoading(false);
          return;
        }

        const email = String(w.email || "").toLowerCase().trim();
        const tenantId = w.tenantId;

        const { data: tenant } = await supabase
          .from("chiefos_tenants")
          .select("name, owner_id")
          .eq("id", tenantId)
          .maybeSingle();

        const ownerId = String((tenant as any)?.owner_id || "").trim();
        if (alive) setBusinessName(String((tenant as any)?.name || ""));

        let profileDisplayName = "";
        let profilePhone = "";
        if (email) {
          const { data: profiles } = await supabase
            .from("chiefos_tenant_actor_profiles")
            .select("display_name, phone_digits, email")
            .eq("tenant_id", tenantId)
            .eq("email", email)
            .limit(1);
          const row = (profiles as any[])?.[0];
          profileDisplayName = String(row?.display_name || "").trim();
          profilePhone = String(row?.phone_digits || "").trim();
        }
        if (alive) setDisplayName(profileDisplayName);

        const weekStart = startOfWeekUTC();

        if (ownerId && profileDisplayName) {
          try {
            const { data: te } = await supabase
              .from("time_entries_v2")
              .select("clock_in, clock_out, entry_type, employee_name")
              .eq("owner_id", ownerId)
              .ilike("employee_name", profileDisplayName)
              .gte("clock_in", weekStart);

            if (alive) {
              const rows = (te as any[]) || [];
              let totalHours = 0;
              const days = new Set<string>();
              for (const r of rows) {
                if (r.entry_type && r.entry_type !== "work") continue;
                const inT = r.clock_in ? new Date(r.clock_in).getTime() : 0;
                const outT = r.clock_out ? new Date(r.clock_out).getTime() : Date.now();
                if (inT && outT > inT) {
                  totalHours += (outT - inT) / 3600000;
                  days.add(String(r.clock_in).slice(0, 10));
                }
              }
              setHours({
                totalHours: Math.round(totalHours * 10) / 10,
                shiftCount: rows.length,
                daysWorked: days.size,
              });
            }
          } catch {
            if (alive) setHours({ totalHours: 0, shiftCount: 0, daysWorked: 0 });
          }

          try {
            const { data: taskRows } = await supabase
              .from("tasks")
              .select("title, due_date, status")
              .eq("owner_id", ownerId)
              .ilike("assigned_to", profileDisplayName)
              .not("status", "in", "(done,completed,deleted)")
              .order("due_date", { ascending: true, nullsFirst: false })
              .limit(10);

            if (alive) setTasks((taskRows as TaskRow[]) || []);
          } catch {
            if (alive) setTasks([]);
          }
        }

        if (ownerId && profilePhone) {
          try {
            const weekDate = startOfWeekDateStr();
            const { data: mi } = await supabase
              .from("mileage_logs")
              .select("distance, unit, trip_date")
              .eq("owner_id", ownerId)
              .eq("employee_user_id", profilePhone)
              .gte("trip_date", weekDate);

            if (alive) {
              const rows = (mi as any[]) || [];
              const total = rows.reduce((sum, r) => sum + Number(r.distance || 0), 0);
              const unit = rows[0]?.unit || "km";
              setMileage({
                distance: Math.round(total * 10) / 10,
                unit,
                trips: rows.length,
              });
            }
          } catch {
            if (alive) setMileage(null);
          }
        }

        try {
          const { data: intake } = await supabase
            .from("intake_items")
            .select("id, title, created_at, status")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .limit(5);

          if (alive) setSubmissions((intake as SubmissionRow[]) || []);
        } catch {
          if (alive) setSubmissions([]);
        }
      } catch {
        // fail-soft
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Employee dashboard
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {loading ? "Loading…" : `Welcome back${displayName ? `, ${displayName}` : ""}.`}
        </h1>
        {!loading && businessName && (
          <div className="mt-1 text-sm text-white/55">
            You're an employee at <span className="text-white/80">{businessName}</span>.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard
          label="Hours this week"
          value={hours ? `${hours.totalHours.toFixed(1)} hrs` : loading ? "…" : "0.0 hrs"}
          sub={
            hours && hours.shiftCount > 0
              ? `${hours.shiftCount} shift${hours.shiftCount === 1 ? "" : "s"} · ${hours.daysWorked} day${hours.daysWorked === 1 ? "" : "s"}`
              : loading
              ? ""
              : "No time logged yet this week"
          }
        />

        <StatCard
          label="Mileage this week"
          value={
            mileage
              ? `${mileage.distance.toFixed(1)} ${mileage.unit}`
              : loading
              ? "…"
              : "—"
          }
          sub={
            mileage && mileage.trips > 0
              ? `${mileage.trips} trip${mileage.trips === 1 ? "" : "s"}`
              : loading
              ? ""
              : "Log mileage via WhatsApp or the web portal"
          }
        />

        <StatCard
          label="Open tasks"
          value={loading ? "…" : String(tasks.length)}
          sub={
            tasks.length > 0
              ? "Assigned to you"
              : loading
              ? ""
              : "No open tasks"
          }
          preview={
            tasks.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {tasks.slice(0, 5).map((t, i) => (
                  <li key={i} className="text-xs text-white/60">
                    • {t.title}
                    {t.due_date && (
                      <span className="ml-1 text-white/35">
                        (due {String(t.due_date).slice(0, 10)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null
          }
        />

        <StatCard
          label="Recent submissions"
          value={loading ? "…" : String(submissions.length)}
          sub={
            submissions.length > 0
              ? "Your uploads, receipts, and logs"
              : loading
              ? ""
              : "No submissions yet"
          }
          preview={
            submissions.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {submissions.slice(0, 3).map((s) => (
                  <li key={s.id} className="text-xs text-white/60">
                    • {s.title || "Untitled"}
                    {s.created_at && (
                      <span className="ml-1 text-white/35">
                        ({String(s.created_at).slice(0, 10)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
        <div className="text-xs font-medium text-white/75">
          Need help navigating ChiefOS or logging your time/mileage?
        </div>
        <div className="mt-0.5 text-[11px] text-white/40">
          Click the gold "C" on the right side of the screen to open ChiefOS Support.
          It can walk you through features you have access to and check your own hours,
          mileage, and tasks.
        </div>
        <div className="mt-2">
          <Link
            href="/app/chief"
            className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-white/90 transition"
          >
            Open Support →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  preview,
}: {
  label: string;
  value: string;
  sub?: string;
  preview?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/45">{sub}</div>}
      {preview}
    </div>
  );
}
