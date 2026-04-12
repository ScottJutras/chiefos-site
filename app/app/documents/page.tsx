"use client";

import { type ReactNode, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import PlanGateBanner from "@/app/app/components/PlanGateBanner";

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineJob = {
  job_id: number;
  job_name: string;
  contract_value_cents: number | null;
  created_at: string | null;
  doc_id: string;
  stage: string;
  lead_notes: string | null;
  lead_source: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

type COItem = {
  id: string;
  number: number;
  description: string;
  amount_cents: number;
  approved_at: string | null;
  job_id: number;
  job_name: string;
};

type SectionDef = {
  key: string;
  label: string;
  count: number;
  href?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(cents: number | null) {
  if (!cents) return "";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STAGE_COLORS: Record<string, string> = {
  lead:     "bg-sky-500/15 text-sky-400 border-sky-500/30",
  quote:    "bg-violet-500/15 text-violet-400 border-violet-500/30",
  contract: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  active:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  invoiced: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  paid:     "bg-green-500/15 text-green-400 border-green-500/30",
  closed:   "bg-white/8 text-white/40 border-white/10",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", quote: "Quote", contract: "Contract",
  active: "Active", invoiced: "Invoiced", paid: "Paid", closed: "Closed",
};

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ item, showStage }: { item: PipelineJob; showStage?: boolean }) {
  return (
    <Link
      href={`/app/jobs/${item.job_id}?tab=documents`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 hover:bg-white/[0.055] hover:border-white/15 transition group"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-white/90 truncate">
            {item.customer_name || "No client"}
          </span>
          {showStage && item.stage && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[item.stage] ?? "bg-white/8 text-white/40 border-white/10"}`}>
              {STAGE_LABELS[item.stage] ?? item.stage}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-white/45 truncate">{item.job_name}</div>
        {item.lead_notes && (
          <div className="mt-0.5 text-xs text-white/30 truncate">{item.lead_notes}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        {item.contract_value_cents ? (
          <div className="text-sm font-medium text-white/70">{fmtMoney(item.contract_value_cents)}</div>
        ) : null}
        <div className="mt-0.5 text-[10px] text-white/30">{fmtDate(item.created_at)}</div>
      </div>
    </Link>
  );
}

// ─── CO Card ──────────────────────────────────────────────────────────────────

function COCard({ co }: { co: COItem }) {
  return (
    <Link
      href={`/app/jobs/${co.job_id}?tab=documents`}
      className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 hover:bg-white/[0.055] hover:border-white/15 transition"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-white/90">CO #{co.number}</span>
          {co.approved_at ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              Approved
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/40">
              Pending approval
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-white/45 truncate">{co.description}</div>
        <div className="mt-0.5 text-[10px] text-white/30">{co.job_name}</div>
      </div>
      <div className="shrink-0 text-sm font-medium text-white/70">{fmtMoney(co.amount_cents)}</div>
    </Link>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
      <p className="text-sm text-white/40">{label}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Add Lead Form ────────────────────────────────────────────────────────────

function AddLeadForm({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [phone,      setPhone]      = useState("");
  const [email,      setEmail]      = useState("");
  const [address,    setAddress]    = useState("");
  const [jobDesc,    setJobDesc]    = useState("");
  const [estValue,   setEstValue]   = useState("");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";
  const labelCls = "mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/40";

  async function save() {
    if (!clientName.trim()) { setErr("Client name is required."); return; }
    if (!jobDesc.trim())    { setErr("Job description is required."); return; }
    setSaving(true); setErr(null);

    try {
      // 1. Customer
      const { data: custData, error: custErr } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenantId,
          name:    clientName.trim(),
          phone:   phone.trim()   || null,
          email:   email.trim()   || null,
          address: address.trim() || null,
        })
        .select("id")
        .single();
      if (custErr || !custData) throw custErr || new Error("Customer insert failed");

      // 2. Job
      const estimatedCents = estValue ? Math.round(parseFloat(estValue) * 100) : null;
      const { data: jobData, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          tenant_id:            tenantId,
          job_name:             jobDesc.trim(),
          status:               "lead",
          active:               false,
          contract_value_cents: estimatedCents,
        })
        .select("id")
        .single();
      if (jobErr || !jobData) throw jobErr || new Error("Job insert failed");

      // 3. Job document
      const { error: docErr } = await supabase
        .from("job_documents")
        .insert({
          job_id:      jobData.id,
          stage:       "lead",
          customer_id: custData.id,
          lead_source: "portal",
          lead_notes:  "",
        });
      if (docErr) throw docErr;

      router.push(`/app/jobs/${jobData.id}?tab=documents`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create lead.";
      setErr(msg);
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-5 space-y-4">
      <div className="text-sm font-semibold text-white/90">New Lead</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Client Name *</label>
          <input
            className={inputCls}
            placeholder="John Smith"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input
            className={inputCls}
            placeholder="519-555-0100"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            className={inputCls}
            placeholder="john@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Estimated Value</label>
          <input
            type="number"
            min="0"
            step="100"
            className={inputCls}
            placeholder="15000"
            value={estValue}
            onChange={e => setEstValue(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Address</label>
          <input
            className={inputCls}
            placeholder="123 Main St, London ON"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Job Description *</label>
          <input
            className={inputCls}
            placeholder="Kitchen renovation, deck build, basement finish…"
            value={jobDesc}
            onChange={e => setJobDesc(e.target.value)}
          />
        </div>
      </div>

      {err && <p className="text-xs text-red-300">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50 transition"
        >
          {saving ? "Creating…" : "Create Lead →"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/10 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Documents Inner ──────────────────────────────────────────────────────────

function DocumentsInner() {
  const searchParams = useSearchParams();
  const activeKey = searchParams.get("section") || "leads";

  const { loading: gateLoading, tenantId, planKey } = useTenantGate({ requireWhatsApp: false });

  const [pipeline,      setPipeline]      = useState<PipelineJob[]>([]);
  const [changeOrders,  setChangeOrders]  = useState<COItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showAddLead,   setShowAddLead]   = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // 1. All jobs for this tenant
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, job_name, name, contract_value_cents, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      const jobRows = (jobsData as any[]) || [];
      const jobIds  = jobRows.map((j: any) => j.id as number);

      if (jobIds.length === 0) {
        setPipeline([]);
        setChangeOrders([]);
        setLoading(false);
        return;
      }

      const jobMap = new Map<number, any>(jobRows.map((j: any) => [j.id as number, j]));

      // 2. Job documents
      const { data: docsData } = await supabase
        .from("job_documents")
        .select("id, stage, lead_notes, lead_source, customer_id, job_id")
        .in("job_id", jobIds);

      const docRows = (docsData as any[]) || [];

      // 3. Customers
      const custIds = [...new Set(
        docRows.map((d: any) => d.customer_id as string | null).filter(Boolean)
      )] as string[];

      const { data: custsData } = custIds.length > 0
        ? await supabase.from("customers").select("id, name, email, phone").in("id", custIds)
        : { data: [] };

      const custMap = new Map<string, any>(
        ((custsData as any[]) || []).map((c: any) => [c.id as string, c])
      );

      // 4. Merge into PipelineJob[]
      const items: PipelineJob[] = docRows.map((doc: any) => {
        const job  = jobMap.get(doc.job_id as number);
        const cust = doc.customer_id ? custMap.get(doc.customer_id as string) : null;
        return {
          job_id:               doc.job_id   as number,
          job_name:             (job?.job_name || job?.name || `Job #${doc.job_id}`) as string,
          contract_value_cents: (job?.contract_value_cents ?? null) as number | null,
          created_at:           (job?.created_at ?? null)           as string | null,
          doc_id:               doc.id       as string,
          stage:                doc.stage    as string,
          lead_notes:           (doc.lead_notes   ?? null)          as string | null,
          lead_source:          (doc.lead_source  ?? null)          as string | null,
          customer_id:          (doc.customer_id  ?? null)          as string | null,
          customer_name:        (cust?.name       ?? null)          as string | null,
          customer_email:       (cust?.email      ?? null)          as string | null,
          customer_phone:       (cust?.phone      ?? null)          as string | null,
        };
      });

      // Sort: newest first (created_at from job)
      items.sort((a, b) => {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return b.created_at.localeCompare(a.created_at);
      });

      setPipeline(items);

      // 5. Change orders
      const { data: cosData } = await supabase
        .from("change_orders")
        .select("id, number, description, amount_cents, approved_at, job_id")
        .in("job_id", jobIds)
        .order("number");

      setChangeOrders(
        ((cosData as any[]) || []).map((co: any) => {
          const job = jobMap.get(co.job_id as number);
          return {
            id:           co.id          as string,
            number:       co.number      as number,
            description:  co.description as string,
            amount_cents: co.amount_cents as number,
            approved_at:  (co.approved_at ?? null) as string | null,
            job_id:       co.job_id      as number,
            job_name:     (job?.job_name || job?.name || `Job #${co.job_id}`) as string,
          };
        })
      );
    } catch {
      // fail-soft — page just shows empty state
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (gateLoading) return <div className="p-8 text-sm text-white/60">Loading…</div>;

  if (planKey === "free") {
    return (
      <PlanGateBanner
        variant="overlay"
        featureName="Documents builder"
        availableOn="Starter and Pro"
        upgradeUrl="/app/settings/billing"
      />
    );
  }

  const byStage = (stage: string) => pipeline.filter(p => p.stage === stage);

  const SECTIONS: SectionDef[] = [
    { key: "leads",         label: "Leads",         count: byStage("lead").length },
    { key: "quotes",        label: "Quotes",         count: byStage("quote").length },
    { key: "contracts",     label: "Contracts",      count: byStage("contract").length },
    { key: "invoices",      label: "Invoices",       count: byStage("invoiced").length },
    { key: "change-orders", label: "Change Orders",  count: changeOrders.length },
    { key: "receipts",      label: "Receipts",       count: byStage("paid").length },
    { key: "tasks",         label: "Tasks",          count: 0, href: "/app/tasks" },
  ];

  function renderContent() {
    if (loading) {
      return (
        <div className="py-12 text-center text-sm text-white/40">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60 mb-3" />
          <div>Loading…</div>
        </div>
      );
    }

    if (activeKey === "leads") {
      const items = byStage("lead");
      return (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Leads</h2>
              <p className="mt-0.5 text-xs text-white/45">
                Potential jobs. Open a lead to build a quote and send it to the client.
              </p>
            </div>
            {!showAddLead && (
              <button
                type="button"
                onClick={() => setShowAddLead(true)}
                className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                + Add Lead
              </button>
            )}
          </div>

          {showAddLead && tenantId && (
            <AddLeadForm tenantId={tenantId} onDone={() => setShowAddLead(false)} />
          )}

          {items.length === 0 && !showAddLead ? (
            <EmptyState
              label="No leads yet. Log your next inquiry and start building a quote."
              action={
                <button
                  type="button"
                  onClick={() => setShowAddLead(true)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                >
                  + Add your first lead
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {items.map(item => <JobCard key={item.doc_id} item={item} />)}
            </div>
          )}
        </div>
      );
    }

    if (activeKey === "quotes") {
      const items = byStage("quote");
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Quotes</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Build itemised quotes, generate PDFs, and send to clients.
            </p>
          </div>
          {items.length === 0 ? (
            <EmptyState label="No quotes yet. Open a lead and advance it to the Quote stage." />
          ) : (
            <div className="space-y-2">
              {items.map(item => <JobCard key={item.doc_id} item={item} />)}
            </div>
          )}
        </div>
      );
    }

    if (activeKey === "contracts") {
      const items = byStage("contract");
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Contracts</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Contracts pre-filled from accepted quotes. Send for e-signature.
            </p>
          </div>
          {items.length === 0 ? (
            <EmptyState label="No contracts yet. Generate a contract once a client accepts your quote." />
          ) : (
            <div className="space-y-2">
              {items.map(item => <JobCard key={item.doc_id} item={item} />)}
            </div>
          )}
        </div>
      );
    }

    if (activeKey === "invoices") {
      const items = byStage("invoiced");
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Invoices</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Final invoices — quote total plus all approved change orders.
            </p>
          </div>
          {items.length === 0 ? (
            <EmptyState label="No invoices yet. Invoice clients once work is complete." />
          ) : (
            <div className="space-y-2">
              {items.map(item => <JobCard key={item.doc_id} item={item} />)}
            </div>
          )}
        </div>
      );
    }

    if (activeKey === "change-orders") {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Change Orders</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Scope changes documented and sent for client approval.
            </p>
          </div>
          {changeOrders.length === 0 ? (
            <EmptyState label="No change orders yet. Add them from a job's Documents tab." />
          ) : (
            <div className="space-y-2">
              {changeOrders.map(co => <COCard key={co.id} co={co} />)}
            </div>
          )}
        </div>
      );
    }

    if (activeKey === "receipts") {
      const items = byStage("paid");
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Receipts</h2>
            <p className="mt-0.5 text-xs text-white/45">
              Payment receipts for completed, paid jobs.
            </p>
          </div>
          {items.length === 0 ? (
            <EmptyState label="No receipts yet. Mark a job as paid to generate a receipt." />
          ) : (
            <div className="space-y-2">
              {items.map(item => <JobCard key={item.doc_id} item={item} />)}
            </div>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <div className="mx-auto max-w-6xl py-2">
      {/* Page header */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Pipeline</div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">Documents</h1>
        <p className="mt-1.5 text-sm text-white/50">
          From first contact to receipt — every document for every job.
        </p>
      </div>

      {/* Mobile chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
        {SECTIONS.map((s) =>
          s.href ? (
            <Link
              key={s.key}
              href={s.href}
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/65 hover:bg-white/10 transition"
            >
              {s.label}
            </Link>
          ) : (
            <Link
              key={s.key}
              href={`/app/documents?section=${s.key}`}
              className={[
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                s.key === activeKey
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10",
              ].join(" ")}
            >
              {s.label}{s.count > 0 ? ` (${s.count})` : ""}
            </Link>
          )
        )}
      </div>

      <div className="flex gap-6">
        {/* Desktop left nav */}
        <nav className="hidden w-44 shrink-0 md:block">
          <ul className="space-y-0.5">
            {SECTIONS.map((s) =>
              s.href ? (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white transition"
                  >
                    <span>{s.label}</span>
                    <span className="text-[10px] text-white/25">→</span>
                  </Link>
                </li>
              ) : (
                <li key={s.key}>
                  <Link
                    href={`/app/documents?section=${s.key}`}
                    className={[
                      "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      s.key === activeKey
                        ? "bg-white/8 text-white"
                        : "text-white/50 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <span>{s.label}</span>
                    {s.count > 0 && (
                      <span className={`text-[10px] font-semibold ${s.key === activeKey ? "text-white/55" : "text-white/30"}`}>
                        {s.count}
                      </span>
                    )}
                  </Link>
                </li>
              )
            )}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-white/60">Loading…</div>}>
      <DocumentsInner />
    </Suspense>
  );
}
