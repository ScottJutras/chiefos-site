"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";

type MileageRow = {
  id: number;
  trip_date: string;
  origin: string | null;
  destination: string | null;
  distance: number;
  unit: string;
  job_name: string | null;
  notes: string | null;
};

export default function EmployeeMileagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MileageRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [unitHint, setUnitHint] = useState("km");

  useEffect(() => {
    (async () => {
      try {
        const w = await fetchWhoami();
        if (!w?.ok) {
          router.replace("/login");
          return;
        }
        const role = String(w.role || "").toLowerCase();
        if (role === "owner" || role === "admin" || role === "board") {
          router.replace("/app/activity/mileage");
          return;
        }

        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id || "";
        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pu?.tenant_id) {
          router.replace("/login");
          return;
        }

        // Resolve actor profile to scope by phone_digits
        const email = String(w.email || "").toLowerCase().trim();
        let phone = "";
        if (email) {
          const { data: profile } = await supabase
            .from("chiefos_tenant_actor_profiles")
            .select("phone_digits")
            .eq("tenant_id", pu.tenant_id)
            .eq("email", email)
            .limit(1);
          phone = String((profile as any[])?.[0]?.phone_digits || "").trim();
        }

        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        let query = supabase
          .from("mileage_logs")
          .select("id, trip_date, origin, destination, distance, unit, job_name, notes")
          .eq("tenant_id", pu.tenant_id)
          .gte("trip_date", ninetyDaysAgo)
          .order("trip_date", { ascending: false })
          .limit(100);

        if (phone) {
          query = query.eq("employee_user_id", phone);
        }

        const { data: mileageRows } = await query;
        const list = (mileageRows as MileageRow[]) || [];
        setRows(list);
        if (list[0]?.unit) setUnitHint(list[0].unit);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load mileage."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function fmtDate(iso: string) {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  const total = rows.reduce((sum, r) => sum + Number(r.distance || 0), 0);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Mileage
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Your trips</h1>
        <div className="mt-1 text-sm text-white/55">Last 90 days</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">
          Total
        </div>
        <div className="text-2xl font-semibold text-white">
          {total.toFixed(1)} {unitHint}
        </div>
        <div className="mt-0.5 text-xs text-white/45">
          {rows.length} trip{rows.length === 1 ? "" : "s"}
        </div>
        <div className="mt-2 text-xs text-white/40">
          Log a trip via WhatsApp: "mileage 42 km [origin] to [destination] for [job]".
          Web portal entry is coming soon.
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">
          History
        </div>
        {loading ? (
          <div className="text-sm text-white/50">Loading…</div>
        ) : err ? (
          <div className="text-sm text-red-300">{err}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-white/50">
            No mileage logged yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="text-white/80">
                      {fmtDate(r.trip_date)}
                      {r.job_name && <span className="text-white/50"> · {r.job_name}</span>}
                    </div>
                    {(r.origin || r.destination) && (
                      <div className="mt-0.5 text-xs text-white/50">
                        {r.origin || "?"} → {r.destination || "?"}
                      </div>
                    )}
                    {r.notes && <div className="mt-0.5 text-xs italic text-white/40">{r.notes}</div>}
                  </div>
                  <div className="shrink-0 text-sm text-white/70">
                    {Number(r.distance).toFixed(1)} {r.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
