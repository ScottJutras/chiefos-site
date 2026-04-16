"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchWhoami } from "@/lib/whoami";
import { useEmployeeJobs } from "../hooks/useEmployeeJobs";

type TaskRow = {
  id: number;
  title: string;
  body: string | null;
  status: string | null;
  due_at: string | null;
  assigned_to: string | null;
  created_at: string | null;
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

export default function EmployeeTasksPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [ownerId, setOwnerId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const { jobs } = useEmployeeJobs();

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newJobId, setNewJobId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async (ownerIdStr: string, displayNameStr: string) => {
    if (!ownerIdStr || !displayNameStr) {
      setTasks([]);
      return;
    }
    try {
      const { data: rows } = await supabase
        .from("tasks")
        .select("id, title, body, status, due_at, assigned_to, created_at")
        .eq("owner_id", ownerIdStr)
        .ilike("assigned_to", displayNameStr)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(50);
      setTasks((rows as TaskRow[]) || []);
    } catch (e: any) {
      setErr(String(e?.message || "Could not load tasks."));
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

        const email = String(w.email || "").toLowerCase().trim();
        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id || "";

        const { data: pu } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pu?.tenant_id) return;

        let name = "";
        if (email) {
          const { data: profile } = await supabase
            .from("chiefos_tenant_actor_profiles")
            .select("display_name")
            .eq("tenant_id", pu.tenant_id)
            .eq("email", email)
            .limit(1);
          name = String((profile as any[])?.[0]?.display_name || "").trim();
        }
        setDisplayName(name);

        const { data: tenant } = await supabase
          .from("chiefos_tenants")
          .select("owner_id")
          .eq("id", pu.tenant_id)
          .maybeSingle();
        const own = String((tenant as any)?.owner_id || "").trim();
        setOwnerId(own);

        await loadTasks(own, name);
      } catch (e: any) {
        setErr(String(e?.message || "Could not load tasks."));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadTasks]);

  async function createTask() {
    setErr(null);
    setOkMsg(null);
    if (!newTitle.trim()) {
      setErr("Title is required.");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: newTitle.trim(),
        body: newBody.trim() || undefined,
        due_date: newDueDate || undefined,
      };
      if (newJobId) body.job_id = Number(newJobId);
      const r = await authedFetch("/api/timeclock/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Could not create task.");
      setOkMsg("Task created.");
      setNewTitle("");
      setNewBody("");
      setNewDueDate("");
      setNewJobId("");
      await loadTasks(ownerId, displayName);
    } catch (e: any) {
      setErr(String(e?.message || "Could not create task."));
    } finally {
      setCreating(false);
    }
  }

  async function markDone(id: number) {
    setErr(null);
    setOkMsg(null);
    try {
      const r = await authedFetch(`/api/timeclock/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "done" }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.message || "Could not update task.");
      setOkMsg("Task done.");
      await loadTasks(ownerId, displayName);
    } catch (e: any) {
      setErr(String(e?.message || "Could not update task."));
    }
  }

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
        <>
          {/* Create task form */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 mb-4">
            <div className="text-sm font-semibold text-white mb-3">Create a task</div>
            <div className="grid gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
              />
              <input
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Notes (optional)"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                />
                <select
                  value={newJobId}
                  onChange={(e) => setNewJobId(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                >
                  <option value="">
                    {jobs.length === 0 ? "No active jobs" : "Select a job (optional)"}
                  </option>
                  {jobs.map((j) => (
                    <option key={j.id} value={String(j.id)}>
                      {j.job_no ? `#${j.job_no} · ` : ""}
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {err && <div className="mt-2 text-xs text-red-300">{err}</div>}
            {okMsg && <div className="mt-2 text-xs text-emerald-300">{okMsg}</div>}

            <button
              onClick={createTask}
              disabled={creating || !newTitle.trim()}
              className={[
                "mt-3 rounded-xl px-4 py-2 text-sm font-semibold transition",
                creating || !newTitle.trim()
                  ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
                  : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
              ].join(" ")}
            >
              {creating ? "Creating…" : "Create task"}
            </button>
          </div>

          {/* Task list */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs font-medium uppercase tracking-widest text-white/40 mb-3">
              Open
            </div>
            {loading ? (
              <div className="text-sm text-white/50">Loading…</div>
            ) : tasks.length === 0 ? (
              <div className="text-sm text-white/50">No open tasks.</div>
            ) : (
              <div className="grid gap-2">
                {tasks.map((t) => (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm text-white/85">{t.title}</div>
                        {t.body && (
                          <div className="mt-0.5 text-xs text-white/45">{t.body}</div>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
                          <span>{t.status || "open"}</span>
                          {t.due_at && <span>· due {String(t.due_at).slice(0, 10)}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => markDone(t.id)}
                        className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
