"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type EmployeeJob = {
  id: number;
  job_no: number | null;
  name: string;
  status: string | null;
};

/**
 * Fetches the owner's active jobs via /api/employee/jobs, for dropdown
 * selection in employee write forms (clock-in, mileage, photos, tasks).
 * Fails soft — returns an empty list and an error string on failure so
 * callers can render a fallback without crashing.
 */
export function useEmployeeJobs() {
  const [jobs, setJobs] = useState<EmployeeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token || "";
        if (!token) {
          if (alive) {
            setError("not-authenticated");
            setLoading(false);
          }
          return;
        }
        const r = await fetch("/api/employee/jobs", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = await r.json();
        if (!alive) return;
        if (j?.ok && Array.isArray(j.items)) {
          setJobs(j.items as EmployeeJob[]);
        } else {
          setError(j?.message || "Could not load jobs.");
        }
      } catch (e: any) {
        if (alive) setError(String(e?.message || "Could not load jobs."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { jobs, loading, error };
}
