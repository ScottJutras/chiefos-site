"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
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

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

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

export default function EmployeeMileagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [rows, setRows] = useState<MileageRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [unitHint, setUnitHint] = useState<"km" | "mi">("km");

  // Form state
  const [tripDate, setTripDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [distance, setDistance] = useState<string>("");
  const [unit, setUnit] = useState<"km" | "mi">("km");
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [jobName, setJobName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async (tid: string, employeePhone: string) => {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      let q = supabase
        .from("mileage_logs")
        .select("id, trip_date, origin, destination, distance, unit, job_name, notes")
        .eq("tenant_id", tid)
        .gte("trip_date", ninetyDaysAgo)
        .order("trip_date", { ascending: false })
        .limit(100);
      if (employeePhone) q = q.eq("employee_user_id", employeePhone);
      const { data: mileageRows } = await q;
      const list = (mileageRows as MileageRow[]) || [];
      setRows(list);
      const firstUnit = list[0]?.unit;
      if (firstUnit === "km" || firstUnit === "mi") {
        setUnitHint(firstUnit);
        setUnit(firstUnit);
      }
    } catch {
      // fail-soft
    }
  }, []);

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

        // Resolve the employee's phone_digits so history scopes correctly.
        const email = String(w.email || "").toLowerCase().trim();
        let employeePhone = "";
        if (email) {
          const { data: profile } = await supabase
            .from("chiefos_tenant_actor_profiles")
            .select("phone_digits")
            .eq("tenant_id", pu.tenant_id)
            .eq("email", email)
            .limit(1);
          employeePhone = String((profile as any[])?.[0]?.phone_digits || "").trim();
        }

        setTenantId(pu.tenant_id);
        setPhone(employeePhone);
        await loadHistory(pu.tenant_id, employeePhone);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load mileage."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadHistory]);

  async function submitTrip() {
    setErr(null);
    setOkMsg(null);

    const dist = Number(distance);
    if (!Number.isFinite(dist) || dist <= 0) {
      setErr("Enter a positive distance.");
      return;
    }

    setBusy(true);
    try {
      const body = {
        trip_date: tripDate,
        distance: dist,
        unit,
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        job_name: jobName.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const r = await authedFetch("/api/employee/mileage", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Could not log trip.");
      setOkMsg(`Logged ${dist.toFixed(1)} ${unit}.`);
      setDistance("");
      setOrigin("");
      setDestination("");
      setJobName("");
      setNotes("");
      await loadHistory(tenantId, phone);
    } catch (e: any) {
      setErr(String(e?.message || "Could not log trip."));
    } finally {
      setBusy(false);
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

      {/* Log a trip */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
        <div className="text-sm font-semibold text-white mb-3">Log a trip</div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label className="text-xs text-white/50">Date</label>
            <input
              type="date"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Distance</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0.0"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value === "mi" ? "mi" : "km")}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              >
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50">Origin (optional)</label>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Shop"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Destination (optional)</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Job site"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-white/50">Job name (optional)</label>
            <input
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Smith reno"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-white/50">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth noting"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
          </div>
        </div>

        {err && <div className="mt-3 text-xs text-red-300">{err}</div>}
        {okMsg && <div className="mt-3 text-xs text-emerald-300">{okMsg}</div>}

        <button
          onClick={submitTrip}
          disabled={busy || !distance.trim()}
          className={[
            "mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            busy || !distance.trim()
              ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
              : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
          ].join(" ")}
        >
          {busy ? "Logging…" : "Log trip"}
        </button>

        <div className="mt-3 text-xs text-white/35">
          You can also log trips via WhatsApp.
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">
          Total
        </div>
        <div className="text-2xl font-semibold text-white">
          {total.toFixed(1)} {unitHint}
        </div>
        <div className="mt-0.5 text-xs text-white/45">
          {rows.length} trip{rows.length === 1 ? "" : "s"} in the last 90 days
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">
          History
        </div>
        {loading ? (
          <div className="text-sm text-white/50">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-white/50">No trips logged yet.</div>
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
