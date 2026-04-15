"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";

type TaskRow = {
  id: number;
  title: string;
  status: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

export default function EmployeeTasksPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
          router.replace("/app/activity/tasks");
          return;
        }
        const plan = String(w.planKey || "free").toLowerCase();
        if (plan === "free") {
          setLocked(true);
          setChecking(false);
          setLoading(false);
          return;
        }
        setChecking(false);

        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id || "";
        const email = String(w.email || "").toLowerCase().trim();

        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pu?.tenant_id) return;

        let displayName = "";
        if (email) {
          const { data: profile } = await supabase
            .from("chiefos_tenant_actor_profiles")
            .select("display_name")
            .eq("tenant_id", pu.tenant_id)
            .eq("email", email)
            .limit(1);
          displayName = String((profile as any[])?.[0]?.display_name || "").trim();
        }

        const { data: tenant } = await supabase
          .from("chiefos_tenants")
          .select("owner_id")
          .eq("id", pu.tenant_id)
          .maybeSingle();
        const ownerId = String((tenant as any)?.owner_id || "").trim();

        if (!ownerId || !displayName) {
          setTasks([]);
          return;
        }

        const { data: rows } = await supabase
          .from("tasks")
          .select("id, title, status, due_date, assigned_to, created_at")
          .eq("owner_id", ownerId)
          .ilike("assigned_to", displayName)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(50);
        setTasks((rows as TaskRow[]) || []);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load tasks."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (checking) return <div className="text-sm text-white/60">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853]">
          Tasks
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Your tasks</h1>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-sm font-semibold text-white">Available on Starter and Pro</div>
          <div className="mt-1 text-xs text-white/50">
            Your employer is on the Free plan. Tasks are unlocked once they
            upgrade to Starter or Pro.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          {loading ? (
            <div className="text-sm text-white/50">Loading…</div>
          ) : err ? (
            <div className="text-sm text-red-300">{err}</div>
          ) : tasks.length === 0 ? (
            <div className="text-sm text-white/50">
              No tasks assigned to you yet. Web portal task creation is
              coming soon — for now your owner can assign tasks via
              WhatsApp or the crew portal.
            </div>
          ) : (
            <div className="grid gap-2">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <div className="text-sm text-white/85">{t.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                    <span>{t.status || "open"}</span>
                    {t.due_date && <span>· due {String(t.due_date).slice(0, 10)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
