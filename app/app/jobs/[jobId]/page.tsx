"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import { type PulsePoint } from "@/app/app/components/BusinessPulseChart";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobRow = {
  id: number;
  job_no: number | null;
  job_name: string | null;
  name: string | null;
  status: string | null;
  active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  material_budget_cents: number | null;
  labour_hours_budget: number | null;
  contract_value_cents: number | null;
};


type JobDocument = {
  id: string;
  stage: string;
  lead_notes: string | null;
  lead_source: string | null;
  customer_id: string | null;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type QuoteLineItem = {
  id: string;
  description: string;
  qty: number;
  unit_price_cents: number;
  category: string | null;
  sort_order: number;
};

type ChangeOrder = {
  id: string;
  number: number;
  description: string;
  amount_cents: number;
  approved_at: string | null;
  file_id: string | null;
};

type JobDocumentFile = {
  id: string;
  kind: string;
  label: string | null;
  storage_bucket: string;
  storage_path: string;
  signature_token: string | null;
  signed_at: string | null;
  sent_at: string | null;
  sent_via: string | null;
  created_at: string;
};

type Tab = "expenses" | "revenue" | "timeclock" | "tasks" | "reminders" | "documents" | "photos";

type TxRow = {
  id: number;
  date: string | null;
  amount_cents: number | null;
  kind: string;
  job_name: string | null;
  job_id: number | null;
  created_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(cents: number) {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  if (abs >= 100_000_00) return `${sign}$${Math.round(abs / 100_00) / 10}M`;
  if (abs >= 10_000_00) return `${sign}$${Math.round(abs / 100_0) / 10}k`;
  return `${sign}$${(abs / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtMoneyFull(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}
function fmtHours(h: number) {
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)}h`;
}


function buildPulsePoints(rows: TxRow[], range: "wtd" | "mtd" | "qtd" | "ytd" | "all"): PulsePoint[] {
  const now = new Date();
  const starts: Record<string, Date | null> = {
    wtd: (() => { const d = new Date(now); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0,0,0,0); return d; })(),
    mtd: (() => { const d = new Date(now); d.setDate(1); d.setHours(0,0,0,0); return d; })(),
    qtd: (() => { const d = new Date(now); d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1); d.setHours(0,0,0,0); return d; })(),
    ytd: (() => { const d = new Date(now); d.setMonth(0,1); d.setHours(0,0,0,0); return d; })(),
    all: null,
  };
  const start = starts[range];
  const filtered = rows.filter((r) => {
    const raw = r.date || r.created_at;
    if (!raw) return false;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return false;
    return !start || d >= start;
  });
  const buckets = new Map<string, { revenue: number; expenses: number }>();
  for (const r of filtered) {
    const raw = r.date || r.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    const b = buckets.get(key) || { revenue: 0, expenses: 0 };
    const cents = Number(r.amount_cents || 0);
    if (r.kind === "revenue") b.revenue += cents; else b.expenses += cents;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      revenueCents: v.revenue,
      expenseCents: v.expenses,
      profitCents: v.revenue - v.expenses,
    }));
}

async function getBearerToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

// ─── PDF Builders ─────────────────────────────────────────────────────────────

function addPdfHeader(doc: jsPDF, businessName: string, title: string, jobName: string, clientName: string | null, clientAddress: string | null, docNumber?: string) {
  const pw = doc.internal.pageSize.width;
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
  doc.text(businessName || "ChiefOS", 40, 46);
  doc.setFontSize(20); doc.text(title, pw - 40, 46, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pw - 40, 62, { align: "right" });
  if (docNumber) doc.text(docNumber, pw - 40, 74, { align: "right" });
  doc.setTextColor(120); doc.setFontSize(7); doc.text("BILL TO", 40, 72);
  doc.setTextColor(0); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(clientName || "—", 40, 84);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60);
  let y = 96;
  if (clientAddress) { doc.text(clientAddress, 40, y); y += 12; }
  doc.text(`Job: ${jobName}`, 40, y);
  return 118;
}

function buildLineTable(doc: jsPDF, startY: number, lines: QuoteLineItem[], totalLabel: string) {
  const rows = lines.map((l) => [
    l.description,
    l.qty % 1 === 0 ? String(l.qty) : l.qty.toFixed(2),
    fmtMoneyFull(l.unit_price_cents),
    fmtMoneyFull(Math.round(l.qty * l.unit_price_cents)),
  ]);
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.unit_price_cents), 0);
  autoTable(doc, {
    startY,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: rows,
    foot: [["", "", totalLabel, fmtMoneyFull(total)]],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold", fontSize: 10 },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 40, halign: "center" }, 2: { cellWidth: 80, halign: "right" }, 3: { cellWidth: 80, halign: "right" } },
  });
  return { finalY: (doc as any).lastAutoTable.finalY, total };
}

function genQuotePdf(businessName: string, job: JobRow, customer: Customer | null, lines: QuoteLineItem[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const startY = addPdfHeader(doc, businessName, "QUOTE", job.job_name || job.name || String(job.id), customer?.name ?? null, customer?.address ?? null);
  buildLineTable(doc, startY, lines, "Quote Total");
  return doc;
}

function genContractPdf(businessName: string, job: JobRow, customer: Customer | null, lines: QuoteLineItem[], terms: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const startY = addPdfHeader(doc, businessName, "CONTRACT", job.job_name || job.name || String(job.id), customer?.name ?? null, customer?.address ?? null);
  const { finalY } = buildLineTable(doc, startY, lines, "Contract Value");
  let y = finalY + 20;
  if (terms.trim()) {
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("Terms & Conditions", 40, y); y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(60);
    const split = doc.splitTextToSize(terms, 520);
    doc.text(split, 40, y); y += split.length * 10 + 20;
  }
  if (y > doc.internal.pageSize.height - 120) { doc.addPage(); y = 60; }
  doc.setDrawColor(200); doc.setLineWidth(0.5);
  doc.setFontSize(9); doc.setTextColor(80);
  doc.text("Client Signature", 40, y); doc.line(40, y + 3, 260, y + 3);
  doc.text("Date", 300, y); doc.line(300, y + 3, 440, y + 3);
  y += 20; doc.setFontSize(8); doc.setTextColor(120);
  doc.text("By signing, you agree to the scope of work and terms above.", 40, y);
  return doc;
}

function genChangeOrderPdf(businessName: string, job: JobRow, customer: Customer | null, co: { number: number; description: string; amount_cents: number }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pw = doc.internal.pageSize.width;
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(businessName || "ChiefOS", 40, 46);
  doc.setFontSize(18); doc.text(`CHANGE ORDER #${co.number}`, pw - 40, 46, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pw - 40, 62, { align: "right" });
  doc.text(`Job: ${job.job_name || job.name || `#${job.id}`}`, 40, 72);
  if (customer?.name) doc.text(`Client: ${customer.name}`, 40, 84);
  autoTable(doc, {
    startY: 106,
    head: [["Description", "Amount"]],
    body: [[co.description, fmtMoneyFull(co.amount_cents)]],
    foot: [["Total Change Order Value", fmtMoneyFull(co.amount_cents)]],
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 100, halign: "right" } },
  });
  const y = (doc as any).lastAutoTable.finalY + 30;
  doc.setDrawColor(200); doc.setLineWidth(0.5); doc.setFontSize(9); doc.setTextColor(80);
  doc.text("Client Approval Signature", 40, y); doc.line(40, y + 3, 280, y + 3);
  doc.text("Date", 320, y); doc.line(320, y + 3, 460, y + 3);
  return doc;
}

function genInvoicePdf(businessName: string, job: JobRow, customer: Customer | null, lines: QuoteLineItem[], approvedCOs: ChangeOrder[], notes: string, invoiceNum: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const startY = addPdfHeader(doc, businessName, "INVOICE", job.job_name || job.name || String(job.id), customer?.name ?? null, customer?.address ?? null, `Invoice ${invoiceNum}`);
  const allRows: QuoteLineItem[] = [...lines];
  // Append approved COs as line items
  for (const co of approvedCOs) {
    allRows.push({ id: co.id, description: `Change Order #${co.number}: ${co.description}`, qty: 1, unit_price_cents: co.amount_cents, category: null, sort_order: 9999 });
  }
  const { finalY, total } = buildLineTable(doc, startY, allRows, "TOTAL DUE");
  void total;
  let y = finalY + 20;
  if (notes.trim()) {
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("Payment Instructions", 40, y); y += 13;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(60);
    const split = doc.splitTextToSize(notes, 520);
    doc.text(split, 40, y);
  }
  return doc;
}

function genReceiptPdf(businessName: string, job: JobRow, customer: Customer | null, amountCents: number) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pw = doc.internal.pageSize.width;
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(businessName || "ChiefOS", 40, 46);
  doc.setFontSize(18); doc.text("RECEIPT", pw - 40, 46, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pw - 40, 62, { align: "right" });
  doc.text(`Job: ${job.job_name || job.name || `#${job.id}`}`, 40, 72);
  doc.setFontSize(10); doc.setTextColor(0); doc.setFont("helvetica", "bold");
  doc.text("Payment Received", 40, 100);
  doc.setFontSize(28); doc.setTextColor(20);
  doc.text(fmtMoneyFull(amountCents), 40, 130);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
  doc.text(`Received from: ${customer?.name || "Client"}`, 40, 155);
  doc.text(`Thank you for your business.`, 40, 170);
  return doc;
}

async function uploadPdf(doc: jsPDF, jobId: number, kind: string, label: string, token: string): Promise<string | null> {
  const pdfBase64 = doc.output("datauristring").split(",")[1];
  const filename = `${kind}-${Date.now()}.pdf`;
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jobId, kind, label, pdfBase64, filename }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.fileId as string;
}

// ─── Life Bar ─────────────────────────────────────────────────────────────────

function LifeBar({ label, actual, budget, unit, inverse = false }: {
  label: string; actual: number; budget: number | null; unit: "money" | "hours"; inverse?: boolean;
}) {
  const actualStr = unit === "money" ? fmtMoney(actual) : fmtHours(actual);
  if (!budget) {
    if (actual === 0) return null;
    return <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span><span className="text-[10px] text-white/35">{actualStr} — no budget set</span></div>;
  }
  const ratio = budget > 0 ? actual / budget : 0;
  const pct = Math.round(ratio * 100);
  const over = pct > 100;
  let barColor = inverse
    ? pct >= 100 ? "bg-emerald-400" : pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500"
    : pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-red-400" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</span>
        <span className="text-[10px] text-white/55">
          {actualStr} / {unit === "money" ? fmtMoney(budget) : fmtHours(budget)}{" "}
          <span className={over ? "font-semibold text-red-400" : pct >= 75 ? "text-amber-300" : "text-white/40"}>{pct}%</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor} ${over ? "opacity-80" : ""}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
        {over && <div className="absolute right-0 top-0 h-full w-0.5 bg-red-400 opacity-70" />}
      </div>
    </div>
  );
}

// ─── DocStatusBadge ───────────────────────────────────────────────────────────

function DocStatusBadge({ file }: { file: JobDocumentFile }) {
  if (file.signed_at) return <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Signed {new Date(file.signed_at).toLocaleDateString()}</span>;
  if (file.sent_at) return <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-400">Sent {new Date(file.sent_at).toLocaleDateString()}</span>;
  return <span className="rounded-full bg-white/8 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/40">Generated</span>;
}

// ─── SendForm ─────────────────────────────────────────────────────────────────

function SendForm({
  fileId, kind, jobName, clientName, defaultEmail, needsSignature, onSent,
}: {
  fileId: string; kind: string; jobName: string; clientName: string | null; defaultEmail: string | null;
  needsSignature: boolean; onSent: () => void;
}) {
  const [to, setTo] = useState(defaultEmail || "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!to.trim()) { setErr("Enter client email."); return; }
    setSending(true); setErr(null);
    const bearerToken = await getBearerToken();
    const res = await fetch("/api/documents/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
      body: JSON.stringify({ fileId, to: to.trim(), kind, jobName, clientName, needsSignature }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j?.error || "Send failed."); setSending(false); return; }
    setSent(true); onSent();
  }

  if (sent) return <div className="text-xs text-emerald-400">Email sent to {to}</div>;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <input type="email" placeholder="Client email" value={to} onChange={(e) => setTo(e.target.value)}
        className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/25 w-52" />
      <button type="button" onClick={send} disabled={sending}
        className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">
        {sending ? "Sending…" : needsSignature ? "Send for signature" : "Send to client"}
      </button>
      {err && <span className="text-xs text-red-300">{err}</span>}
    </div>
  );
}


// ─── Documents Tab ─────────────────────────────────────────────────────────────

const STAGES = ["lead", "quote", "contract", "active", "invoiced", "paid", "closed"] as const;
const STAGE_LABELS: Record<string, string> = { lead: "Lead", quote: "Quote", contract: "Contract", active: "Active", invoiced: "Invoiced", paid: "Paid", closed: "Closed" };
const LEAD_SOURCES = ["whatsapp", "portal", "referral", "ad", "phone", "other"];

function DocumentsTab({
  job, jobDoc, customer, quoteLines, changeOrders, documentFiles, tenantId, businessName,
  onDocUpdated, onCustomerUpdated, onQuoteLinesUpdated, onChangeOrdersUpdated, onDocFileAdded, onJobUpdated,
}: {
  job: JobRow; jobDoc: JobDocument | null; customer: Customer | null; quoteLines: QuoteLineItem[];
  changeOrders: ChangeOrder[]; documentFiles: JobDocumentFile[]; tenantId: string; businessName: string;
  onDocUpdated: (u: Partial<JobDocument>) => void; onCustomerUpdated: (c: Customer) => void;
  onQuoteLinesUpdated: (l: QuoteLineItem[]) => void; onChangeOrdersUpdated: (co: ChangeOrder[]) => void;
  onDocFileAdded: (f: JobDocumentFile) => void; onJobUpdated: (u: Partial<JobRow>) => void;
}) {
  const currentStage = jobDoc?.stage ?? "lead";
  const stageIdx = STAGES.indexOf(currentStage as typeof STAGES[number]);
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";
  const sectionCls = "rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden";
  const quoteTotalCents = quoteLines.reduce((s, l) => s + Math.round(l.qty * l.unit_price_cents), 0);
  const approvedCOs = changeOrders.filter((co) => co.approved_at);
  const coTotalCents = approvedCOs.reduce((s, co) => s + co.amount_cents, 0);
  const invoiceTotalCents = quoteTotalCents + coTotalCents;

  // ── Lead state
  const [leadNotes, setLeadNotes] = useState(jobDoc?.lead_notes ?? "");
  const [leadSource, setLeadSource] = useState(jobDoc?.lead_source ?? "");
  const [savingLead, setSavingLead] = useState(false);
  const [custName, setCustName] = useState(customer?.name ?? "");
  const [custPhone, setCustPhone] = useState(customer?.phone ?? "");
  const [custEmail, setCustEmail] = useState(customer?.email ?? "");
  const [custAddress, setCustAddress] = useState(customer?.address ?? "");
  const [savingCust, setSavingCust] = useState(false);
  const [custErr, setCustErr] = useState<string | null>(null);

  // ── Quote state
  const [lines, setLines] = useState<QuoteLineItem[]>(quoteLines);
  const [addingLine, setAddingLine] = useState(false);
  const [newDesc, setNewDesc] = useState(""); const [newQty, setNewQty] = useState("1"); const [newPrice, setNewPrice] = useState(""); const [newCat, setNewCat] = useState("materials");
  const [savingLine, setSavingLine] = useState(false); const [lineErr, setLineErr] = useState<string | null>(null);
  const [genQuoteLoading, setGenQuoteLoading] = useState(false);
  const [showQuoteSend, setShowQuoteSend] = useState(false);
  const [lastQuoteFileId, setLastQuoteFileId] = useState<string | null>(null);

  // ── Contract state
  const [contractTerms, setContractTerms] = useState("Payment is due within 14 days of invoice. A deposit of 30% is required before work commences. All materials remain the property of the contractor until paid in full.");
  const [genContractLoading, setGenContractLoading] = useState(false);
  const [showContractSend, setShowContractSend] = useState(false);
  const [lastContractFileId, setLastContractFileId] = useState<string | null>(null);

  // ── Change order state
  const [coList, setCoList] = useState<ChangeOrder[]>(changeOrders);
  const [addingCO, setAddingCO] = useState(false);
  const [newCODesc, setNewCODesc] = useState(""); const [newCOAmount, setNewCOAmount] = useState("");
  const [savingCO, setSavingCO] = useState(false); const [coErr, setCoErr] = useState<string | null>(null);
  const [genCOLoading, setGenCOLoading] = useState<string | null>(null);
  const [showCOSend, setShowCOSend] = useState<string | null>(null);
  const [lastCOFileId, setLastCOFileId] = useState<{ [coId: string]: string }>({});

  // ── Invoice state
  const [invoiceNotes, setInvoiceNotes] = useState("E-transfer, cheque, or cash accepted. Please include job name as reference.");
  const [genInvoiceLoading, setGenInvoiceLoading] = useState(false);
  const [showInvoiceSend, setShowInvoiceSend] = useState(false);
  const [lastInvoiceFileId, setLastInvoiceFileId] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  // ── Receipt state
  const [genReceiptLoading, setGenReceiptLoading] = useState(false);
  const [showReceiptSend, setShowReceiptSend] = useState(false);
  const [lastReceiptFileId, setLastReceiptFileId] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState("");
  const [referralCopied, setReferralCopied] = useState(false);

  async function ensureJobDoc() {
    if (jobDoc) return jobDoc.id;
    const { data } = await supabase.from("job_documents").insert({ tenant_id: tenantId, job_id: job.id, stage: "lead" }).select("id, stage, lead_notes, lead_source, customer_id").single();
    if (data) { onDocUpdated(data); return data.id; }
    throw new Error("Failed to create document record");
  }

  async function advanceStage(s: string) {
    const docId = await ensureJobDoc();
    await supabase.from("job_documents").update({ stage: s, updated_at: new Date().toISOString() }).eq("id", docId);
    onDocUpdated({ stage: s });
  }

  async function saveLead() {
    setSavingLead(true);
    const docId = await ensureJobDoc();
    await supabase.from("job_documents").update({ lead_notes: leadNotes || null, lead_source: leadSource || null, updated_at: new Date().toISOString() }).eq("id", docId);
    onDocUpdated({ lead_notes: leadNotes || null, lead_source: leadSource || null });
    setSavingLead(false);
  }

  async function saveCustomer() {
    if (!custName.trim()) { setCustErr("Name is required."); return; }
    setSavingCust(true); setCustErr(null);
    const docId = await ensureJobDoc();
    let custId = customer?.id;
    if (custId) {
      await supabase.from("customers").update({ name: custName.trim(), phone: custPhone.trim() || null, email: custEmail.trim() || null, address: custAddress.trim() || null }).eq("id", custId);
    } else {
      const { data } = await supabase.from("customers").insert({ tenant_id: tenantId, name: custName.trim(), phone: custPhone.trim() || null, email: custEmail.trim() || null, address: custAddress.trim() || null }).select("id, name, phone, email, address").single();
      if (data) custId = data.id;
    }
    if (custId) {
      await supabase.from("job_documents").update({ customer_id: custId }).eq("id", docId);
      onCustomerUpdated({ id: custId, name: custName.trim(), phone: custPhone.trim() || null, email: custEmail.trim() || null, address: custAddress.trim() || null, notes: null });
      onDocUpdated({ customer_id: custId });
    }
    setSavingCust(false);
  }

  async function addLine() {
    if (!newDesc.trim()) { setLineErr("Description required."); return; }
    const priceCents = Math.round(parseFloat(newPrice || "0") * 100);
    const qty = parseFloat(newQty || "1");
    if (isNaN(priceCents) || isNaN(qty) || qty <= 0) { setLineErr("Enter valid qty and price."); return; }
    setSavingLine(true); setLineErr(null);
    await ensureJobDoc();
    const { data } = await supabase.from("quote_line_items").insert({ job_id: job.id, tenant_id: tenantId, description: newDesc.trim(), qty, unit_price_cents: priceCents, category: newCat, sort_order: lines.length }).select("id, description, qty, unit_price_cents, category, sort_order").single();
    if (data) { const updated = [...lines, data as QuoteLineItem]; setLines(updated); onQuoteLinesUpdated(updated); }
    setNewDesc(""); setNewQty("1"); setNewPrice(""); setAddingLine(false); setSavingLine(false);
  }

  async function deleteLine(id: string) {
    await supabase.from("quote_line_items").delete().eq("id", id);
    const updated = lines.filter((l) => l.id !== id); setLines(updated); onQuoteLinesUpdated(updated);
  }

  async function genAndUpload(pdfDoc: jsPDF, kind: string, label: string): Promise<string | null> {
    const tok = await getBearerToken();
    return uploadPdf(pdfDoc, job.id, kind, label, tok);
  }

  async function genQuote() {
    setGenQuoteLoading(true);
    const pdf = genQuotePdf(businessName, job, customer, lines);
    const fileId = await genAndUpload(pdf, "quote", "Quote");
    if (fileId) {
      const f: JobDocumentFile = { id: fileId, kind: "quote", label: "Quote", storage_bucket: "intake-uploads", storage_path: "", signature_token: null, signed_at: null, sent_at: null, sent_via: null, created_at: new Date().toISOString() };
      onDocFileAdded(f); setLastQuoteFileId(fileId); setShowQuoteSend(true); pdf.save(`quote-${job.id}.pdf`);
    }
    setGenQuoteLoading(false);
  }

  async function genContract() {
    setGenContractLoading(true);
    const pdf = genContractPdf(businessName, job, customer, lines, contractTerms);
    const fileId = await genAndUpload(pdf, "contract", "Contract");
    if (fileId) {
      const f: JobDocumentFile = { id: fileId, kind: "contract", label: "Contract", storage_bucket: "intake-uploads", storage_path: "", signature_token: null, signed_at: null, sent_at: null, sent_via: null, created_at: new Date().toISOString() };
      onDocFileAdded(f); setLastContractFileId(fileId); setShowContractSend(true); pdf.save(`contract-${job.id}.pdf`);
    }
    setGenContractLoading(false);
  }

  async function genCOPdf(co: ChangeOrder) {
    setGenCOLoading(co.id);
    const pdf = genChangeOrderPdf(businessName, job, customer, co);
    const fileId = await genAndUpload(pdf, "change_order", `Change Order #${co.number}`);
    if (fileId) {
      await supabase.from("change_orders").update({ file_id: fileId }).eq("id", co.id);
      const f: JobDocumentFile = { id: fileId, kind: "change_order", label: `Change Order #${co.number}`, storage_bucket: "intake-uploads", storage_path: "", signature_token: null, signed_at: null, sent_at: null, sent_via: null, created_at: new Date().toISOString() };
      onDocFileAdded(f);
      setLastCOFileId((prev) => ({ ...prev, [co.id]: fileId }));
      setShowCOSend(co.id);
      pdf.save(`change-order-${co.number}-${job.id}.pdf`);
    }
    setGenCOLoading(null);
  }

  async function addChangeOrder() {
    if (!newCODesc.trim()) { setCoErr("Description required."); return; }
    const amtCents = Math.round(parseFloat(newCOAmount || "0") * 100);
    if (isNaN(amtCents) || amtCents <= 0) { setCoErr("Enter a valid amount."); return; }
    setSavingCO(true); setCoErr(null);
    const nextNum = Math.max(0, ...coList.map((c) => c.number)) + 1;
    const { data } = await supabase.from("change_orders").insert({ job_id: job.id, tenant_id: tenantId, number: nextNum, description: newCODesc.trim(), amount_cents: amtCents }).select("id, number, description, amount_cents, approved_at, file_id").single();
    if (data) { const updated = [...coList, data as ChangeOrder]; setCoList(updated); onChangeOrdersUpdated(updated); }
    setNewCODesc(""); setNewCOAmount(""); setAddingCO(false); setSavingCO(false);
  }

  async function approveCO(co: ChangeOrder) {
    const now = new Date().toISOString();
    await supabase.from("change_orders").update({ approved_at: now }).eq("id", co.id);
    const updated = coList.map((c) => c.id === co.id ? { ...c, approved_at: now } : c);
    setCoList(updated); onChangeOrdersUpdated(updated);
    // Recalculate contract value
    const newContractValue = quoteTotalCents + updated.filter((c) => c.approved_at).reduce((s, c) => s + c.amount_cents, 0);
    await supabase.from("jobs").update({ contract_value_cents: newContractValue }).eq("id", job.id);
    onJobUpdated({ contract_value_cents: newContractValue });
  }

  async function genInvoice() {
    setGenInvoiceLoading(true);
    const invoiceNum = `INV-${job.id}-${Date.now().toString().slice(-4)}`;
    const pdf = genInvoicePdf(businessName, job, customer, lines, approvedCOs, invoiceNotes, invoiceNum);
    const fileId = await genAndUpload(pdf, "invoice", `Invoice ${invoiceNum}`);
    if (fileId) {
      const f: JobDocumentFile = { id: fileId, kind: "invoice", label: `Invoice ${invoiceNum}`, storage_bucket: "intake-uploads", storage_path: "", signature_token: null, signed_at: null, sent_at: null, sent_via: null, created_at: new Date().toISOString() };
      onDocFileAdded(f); setLastInvoiceFileId(fileId); setShowInvoiceSend(true); pdf.save(`invoice-${job.id}.pdf`);
    }
    setGenInvoiceLoading(false);
  }

  async function markPaid() {
    setMarkingPaid(true);
    await advanceStage("paid");
    // Record revenue transaction
    await supabase.from("transactions").insert({ tenant_id: tenantId, job_id: job.id, amount_cents: invoiceTotalCents, kind: "revenue", description: `Final payment — ${job.job_name || job.name}`, transaction_date: new Date().toISOString().split("T")[0] }).then(() => {});
    setMarkingPaid(false);
  }

  async function genReceipt() {
    setGenReceiptLoading(true);
    const pdf = genReceiptPdf(businessName, job, customer, invoiceTotalCents);
    const fileId = await genAndUpload(pdf, "receipt", "Receipt");
    if (fileId) {
      const f: JobDocumentFile = { id: fileId, kind: "receipt", label: "Receipt", storage_bucket: "intake-uploads", storage_path: "", signature_token: null, signed_at: null, sent_at: null, sent_via: null, created_at: new Date().toISOString() };
      onDocFileAdded(f); setLastReceiptFileId(fileId); setShowReceiptSend(true); pdf.save(`receipt-${job.id}.pdf`);
    }
    setGenReceiptLoading(false);
  }

  async function copyReferral() {
    const msg = `Hi ${customer?.name || "there"}! Thanks so much for choosing us for your ${job.job_name || "project"}. We hope you're happy with the work. If you have a moment, a Google review would mean the world to us: ${referralLink}\n\nAnd if you know anyone else who needs our help, we'd love the referral!`;
    await navigator.clipboard.writeText(msg);
    setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2500);
  }

  const contractFiles = documentFiles.filter((f) => f.kind === "contract");
  const quoteFiles = documentFiles.filter((f) => f.kind === "quote");
  const invoiceFiles = documentFiles.filter((f) => f.kind === "invoice");
  const receiptFiles = documentFiles.filter((f) => f.kind === "receipt");

  return (
    <div className="space-y-4">

      {/* Stage tracker */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-3">Stage</div>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <button type="button" onClick={() => advanceStage(s)} className={["rounded-full px-3 py-1 text-[11px] font-medium border transition", s === currentStage ? "border-white/20 bg-white text-black" : i <= stageIdx ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60"].join(" ")}>{STAGE_LABELS[s]}</button>
              {i < STAGES.length - 1 && <span className="text-white/15 text-xs">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── LEAD ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="text-sm font-semibold text-white/90">Lead</div>
          <div className="text-xs text-white/40 mt-0.5">First contact details</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Customer</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-[11px] text-white/50">Name *</label><input type="text" placeholder="John Smith" value={custName} onChange={(e) => setCustName(e.target.value)} className={inputCls} /></div>
              <div><label className="mb-1 block text-[11px] text-white/50">Phone</label><input type="tel" placeholder="+1 416 555 0100" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className={inputCls} /></div>
              <div><label className="mb-1 block text-[11px] text-white/50">Email</label><input type="email" placeholder="john@example.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className={inputCls} /></div>
              <div><label className="mb-1 block text-[11px] text-white/50">Address</label><input type="text" placeholder="Job site address" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} className={inputCls} /></div>
            </div>
            {custErr && <div className="text-xs text-red-300">{custErr}</div>}
            <button type="button" onClick={saveCustomer} disabled={savingCust} className="rounded-xl bg-white/8 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/12 transition disabled:opacity-50">{savingCust ? "Saving…" : customer ? "Update customer" : "Save customer"}</button>
          </div>
          <div className="space-y-3 pt-3 border-t border-white/8">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Lead details</div>
            <div><label className="mb-1 block text-[11px] text-white/50">Notes (what the client wants)</label><textarea rows={3} placeholder="e.g. Replace roof on 2-storey, 40 sq. Wants architectural shingles. Needs quote by Friday." value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} className={`${inputCls} resize-none`} /></div>
            <div><label className="mb-1 block text-[11px] text-white/50">How did they find you?</label><select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} className={inputCls}><option value="">— Select source —</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
            <button type="button" onClick={saveLead} disabled={savingLead} className="rounded-xl bg-white/8 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/12 transition disabled:opacity-50">{savingLead ? "Saving…" : "Save notes"}</button>
          </div>
          {currentStage === "lead" && (
            <div className="pt-2 border-t border-white/8">
              <button type="button" onClick={() => advanceStage("quote")} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition">Ready to quote → Move to Quote stage</button>
            </div>
          )}
        </div>
      </div>

      {/* ── QUOTE ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-semibold text-white/90">Quote</div><div className="text-xs text-white/40 mt-0.5">Line items and pricing</div></div>
            {lines.length > 0 && <div className="text-right"><div className="text-[10px] text-white/40">Total</div><div className="text-lg font-semibold text-white/90">{fmtMoney(quoteTotalCents)}</div></div>}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {lines.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] uppercase tracking-[0.14em] text-white/35 px-1"><span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span></div>
              {[...lines].sort((a, b) => a.sort_order - b.sort_order).map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                  <div><div className="text-sm text-white/85">{l.description}</div>{l.category && <div className="text-[10px] text-white/35 capitalize">{l.category}</div>}</div>
                  <span className="text-sm text-white/60">{l.qty % 1 === 0 ? l.qty.toFixed(0) : l.qty.toFixed(1)}</span>
                  <span className="text-sm text-white/60">{fmtMoney(l.unit_price_cents)}</span>
                  <div className="flex items-center gap-2"><span className="text-sm font-medium text-white/80">{fmtMoney(Math.round(l.qty * l.unit_price_cents))}</span><button type="button" onClick={() => deleteLine(l.id)} className="text-white/20 hover:text-red-400 transition text-xs">✕</button></div>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1 border-t border-white/8 px-1"><span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Quote total</span><span className="text-sm font-semibold text-white/90">{fmtMoney(quoteTotalCents)}</span></div>
            </div>
          ) : <div className="text-sm text-white/35 italic">No line items yet.</div>}

          {addingLine ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Add line item</div>
              <div><label className="mb-1 block text-[11px] text-white/50">Description *</label><input type="text" placeholder="e.g. Architectural shingles — 40 sq" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={inputCls} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="mb-1 block text-[11px] text-white/50">Qty</label><input type="number" min="0.01" step="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-[11px] text-white/50">Unit price ($)</label><input type="number" min="0" step="0.01" placeholder="0.00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={inputCls} /></div>
                <div><label className="mb-1 block text-[11px] text-white/50">Category</label><select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={inputCls}><option value="materials">Materials</option><option value="labour">Labour</option><option value="other">Other</option></select></div>
              </div>
              {lineErr && <div className="text-xs text-red-300">{lineErr}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={addLine} disabled={savingLine} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">{savingLine ? "Adding…" : "Add item"}</button>
                <button type="button" onClick={() => { setAddingLine(false); setLineErr(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingLine(true)} className="rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs font-medium text-white/50 hover:border-white/25 hover:text-white/70 transition w-full text-center">+ Add line item</button>
          )}

          {lines.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/8">
              {/* Previous quote files */}
              {quoteFiles.slice(0, 2).map((f) => <DocStatusBadge key={f.id} file={f} />)}
              <button type="button" onClick={genQuote} disabled={genQuoteLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-50">{genQuoteLoading ? "Generating…" : "Generate & Download Quote PDF"}</button>
              {showQuoteSend && lastQuoteFileId && (
                <SendForm fileId={lastQuoteFileId} kind="quote" jobName={job.job_name || job.name || String(job.id)} clientName={customer?.name ?? null} defaultEmail={customer?.email ?? null} needsSignature={false} onSent={() => setShowQuoteSend(false)} />
              )}
              {currentStage === "quote" && (
                <button type="button" onClick={() => advanceStage("contract")} className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">Quote accepted → Contract</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTRACT ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="text-sm font-semibold text-white/90">Contract</div>
          <div className="text-xs text-white/40 mt-0.5">Generate a contract from your quote, send for e-signature</div>
        </div>
        <div className="p-5 space-y-4">
          {lines.length === 0 ? (
            <div className="text-sm text-white/35 italic">Add quote line items first.</div>
          ) : (
            <>
              <div className="text-xs text-white/55">Contract will include all {lines.length} line item{lines.length === 1 ? "" : "s"} from the quote — total {fmtMoney(quoteTotalCents)}.</div>
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Terms & Conditions</label>
                <textarea rows={4} value={contractTerms} onChange={(e) => setContractTerms(e.target.value)} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex flex-wrap gap-2 items-start">
                {contractFiles.slice(0, 2).map((f) => <DocStatusBadge key={f.id} file={f} />)}
                <button type="button" onClick={genContract} disabled={genContractLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-50">{genContractLoading ? "Generating…" : "Generate & Download Contract PDF"}</button>
              </div>
              {showContractSend && lastContractFileId && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Send for e-signature</div>
                  <p className="text-xs text-white/55">Client will receive an email with a link to review the contract and sign with their finger or mouse.</p>
                  <SendForm fileId={lastContractFileId} kind="contract" jobName={job.job_name || job.name || String(job.id)} clientName={customer?.name ?? null} defaultEmail={customer?.email ?? null} needsSignature={true} onSent={() => setShowContractSend(false)} />
                </div>
              )}
              {currentStage === "contract" && contractFiles.some((f) => f.signed_at) && (
                <button type="button" onClick={() => advanceStage("active")} className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">Contract signed → Start job</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CHANGE ORDERS ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-semibold text-white/90">Change Orders</div><div className="text-xs text-white/40 mt-0.5">Scope changes requiring client approval</div></div>
            {coList.length > 0 && <div className="text-right"><div className="text-[10px] text-white/40">CO total (approved)</div><div className="text-base font-semibold text-white/80">{fmtMoney(coTotalCents)}</div></div>}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {coList.length > 0 ? (
            <div className="space-y-3">
              {coList.map((co) => {
                const coFile = documentFiles.find((f) => f.id === co.file_id);
                return (
                  <div key={co.id} className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white/85">CO #{co.number}: {co.description}</div>
                        <div className="text-xs text-white/50">{fmtMoney(co.amount_cents)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {co.approved_at ? (
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Approved</span>
                        ) : (
                          <button type="button" onClick={() => approveCO(co)} className="rounded-full bg-white/8 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60 hover:bg-white/12 transition">Mark approved</button>
                        )}
                        {coFile && <DocStatusBadge file={coFile} />}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => genCOPdf(co)} disabled={genCOLoading === co.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-50">{genCOLoading === co.id ? "Generating…" : "Generate CO PDF"}</button>
                      {showCOSend === co.id && lastCOFileId[co.id] && (
                        <SendForm fileId={lastCOFileId[co.id]} kind="change_order" jobName={job.job_name || job.name || String(job.id)} clientName={customer?.name ?? null} defaultEmail={customer?.email ?? null} needsSignature={true} onSent={() => setShowCOSend(null)} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="text-sm text-white/35 italic">No change orders yet.</div>}

          {addingCO ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">New change order</div>
              <div><label className="mb-1 block text-[11px] text-white/50">Description *</label><input type="text" placeholder="e.g. Extra insulation in attic space" value={newCODesc} onChange={(e) => setNewCODesc(e.target.value)} className={inputCls} /></div>
              <div><label className="mb-1 block text-[11px] text-white/50">Amount ($) *</label><input type="number" min="0.01" step="0.01" placeholder="e.g. 850.00" value={newCOAmount} onChange={(e) => setNewCOAmount(e.target.value)} className={inputCls} /></div>
              {coErr && <div className="text-xs text-red-300">{coErr}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={addChangeOrder} disabled={savingCO} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">{savingCO ? "Saving…" : "Add change order"}</button>
                <button type="button" onClick={() => { setAddingCO(false); setCoErr(null); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingCO(true)} className="rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs font-medium text-white/50 hover:border-white/25 hover:text-white/70 transition w-full text-center">+ Add change order</button>
          )}
        </div>
      </div>

      {/* ── FINAL INVOICE ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-semibold text-white/90">Final Invoice</div><div className="text-xs text-white/40 mt-0.5">Quote + approved change orders</div></div>
            {lines.length > 0 && <div className="text-right"><div className="text-[10px] text-white/40">Invoice total</div><div className="text-lg font-semibold text-white/90">{fmtMoney(invoiceTotalCents)}</div></div>}
          </div>
        </div>
        <div className="p-5 space-y-4">
          {lines.length === 0 ? (
            <div className="text-sm text-white/35 italic">Add quote line items first.</div>
          ) : (
            <>
              <div className="space-y-1 text-xs text-white/55">
                <div>Quote: {fmtMoney(quoteTotalCents)}</div>
                {approvedCOs.length > 0 && <div>Approved change orders: +{fmtMoney(coTotalCents)} ({approvedCOs.length} CO{approvedCOs.length !== 1 ? "s" : ""})</div>}
                <div className="font-semibold text-white/80">Total: {fmtMoney(invoiceTotalCents)}</div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/50">Payment instructions</label>
                <textarea rows={3} value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex flex-wrap gap-2 items-start">
                {invoiceFiles.slice(0, 2).map((f) => <DocStatusBadge key={f.id} file={f} />)}
                <button type="button" onClick={genInvoice} disabled={genInvoiceLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-50">{genInvoiceLoading ? "Generating…" : "Generate & Download Invoice PDF"}</button>
              </div>
              {showInvoiceSend && lastInvoiceFileId && (
                <SendForm fileId={lastInvoiceFileId} kind="invoice" jobName={job.job_name || job.name || String(job.id)} clientName={customer?.name ?? null} defaultEmail={customer?.email ?? null} needsSignature={false} onSent={() => setShowInvoiceSend(false)} />
              )}
              {currentStage !== "paid" && currentStage !== "closed" && (
                <div className="pt-2 border-t border-white/8">
                  <button type="button" onClick={markPaid} disabled={markingPaid} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400 transition disabled:opacity-50">{markingPaid ? "Marking paid…" : `Mark as paid — ${fmtMoney(invoiceTotalCents)}`}</button>
                  <div className="mt-1 text-[10px] text-white/30">This records a revenue transaction and advances the job to Paid.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── RECEIPT + REFERRAL ── */}
      <div className={sectionCls}>
        <div className="px-5 py-4 border-b border-white/8">
          <div className="text-sm font-semibold text-white/90">Receipt & Referral</div>
          <div className="text-xs text-white/40 mt-0.5">Send a receipt, ask for a review or referral</div>
        </div>
        <div className="p-5 space-y-5">
          {/* Receipt */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Payment receipt</div>
            <div className="text-xs text-white/55">Receipt amount: {fmtMoney(invoiceTotalCents)}</div>
            <div className="flex flex-wrap gap-2 items-start">
              {receiptFiles.slice(0, 2).map((f) => <DocStatusBadge key={f.id} file={f} />)}
              <button type="button" onClick={genReceipt} disabled={genReceiptLoading} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-50">{genReceiptLoading ? "Generating…" : "Generate & Download Receipt PDF"}</button>
            </div>
            {showReceiptSend && lastReceiptFileId && (
              <SendForm fileId={lastReceiptFileId} kind="receipt" jobName={job.job_name || job.name || String(job.id)} clientName={customer?.name ?? null} defaultEmail={customer?.email ?? null} needsSignature={false} onSent={() => setShowReceiptSend(false)} />
            )}
          </div>

          {/* Referral */}
          <div className="space-y-3 pt-4 border-t border-white/8">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Review & referral request</div>
            <div>
              <label className="mb-1 block text-[11px] text-white/50">Your Google / HomeStars review link</label>
              <input type="url" placeholder="https://g.page/r/..." value={referralLink} onChange={(e) => setReferralLink(e.target.value)} className={inputCls} />
            </div>
            <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-white/55 leading-relaxed">
              {`Hi ${customer?.name || "[Client name]"}! Thanks so much for choosing us for your ${job.job_name || "[Job]"}. We hope you're happy with the work. If you have a moment, a Google review would mean the world to us: ${referralLink || "[your review link]"}\n\nAnd if you know anyone else who needs our help, we'd love the referral!`}
            </div>
            <button type="button" onClick={copyReferral} disabled={!referralLink} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-40">
              {referralCopied ? "Copied!" : "Copy message to clipboard"}
            </button>
            <div className="text-[10px] text-white/30">Paste this into WhatsApp, SMS, or email.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Types (continued) ────────────────────────────────────────────────────────

type RangeKey = "wtd" | "mtd" | "qtd" | "ytd" | "all";

const RANGE_LABELS: Record<RangeKey, string> = { wtd: "WTD", mtd: "MTD", qtd: "QTD", ytd: "YTD", all: "All" };

// ─── Job Performance Chart ────────────────────────────────────────────────────

const ML = 62, MR = 16, MT = 18, MB = 44;
const SVG_W = 560, SVG_H = 230;
const PW = SVG_W - ML - MR;
const PH = SVG_H - MT - MB;

function JobPerformanceChart({ jobId }: { jobId: number }) {
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("mtd");

  useEffect(() => {
    supabase.from("transactions").select("id, date, amount_cents, kind, job_name, job_id, created_at")
      .eq("job_id", jobId).order("date", { ascending: true }).limit(2000)
      .then(({ data }) => { setTxRows((data as TxRow[]) || []); setLoading(false); });
  }, [jobId]);

  const points = useMemo(() => buildPulsePoints(txRows, range), [txRows, range]);
  const n = points.length;

  const allVals = points.flatMap((p) => [p.revenueCents, p.expenseCents, p.profitCents]);
  const yMin = Math.min(0, ...(allVals.length ? allVals : [0]));
  const yMax = Math.max(1, ...(allVals.length ? allVals : [1]));
  const yRange = yMax - yMin || 1;

  function toY(v: number) { return MT + PH * (1 - (v - yMin) / yRange); }
  function toX(i: number) { return n <= 1 ? ML + PW / 2 : ML + (i / (n - 1)) * PW; }
  function makePath(vals: number[]) {
    return vals.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  }

  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange / 4) * i);
  const xLabels: { x: number; label: string }[] = n === 0 ? [] : n === 1
    ? [{ x: toX(0), label: points[0].label }]
    : [
        { x: toX(0), label: points[0].label },
        ...(n >= 3 ? [{ x: toX(Math.floor((n - 1) / 2)), label: points[Math.floor((n - 1) / 2)].label }] : []),
        { x: toX(n - 1), label: points[n - 1].label },
      ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Performance</div>
          <h2 className="mt-1 text-lg font-semibold text-white/95">Job overview</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["wtd", "mtd", "qtd", "ytd", "all"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setRange(k)}
              className={["rounded-full border px-3 py-1.5 text-xs font-medium transition",
                range === k ? "border-white/20 bg-white text-black" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
              ].join(" ")}>
              {RANGE_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          </div>
        ) : n === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-white/40">
            No transactions in this range yet.
          </div>
        ) : (
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ height: 200 }}>
            {/* Horizontal grid lines + Y axis labels */}
            {yTicks.map((v, i) => {
              const y = toY(v);
              const isZero = Math.abs(v) < yRange * 0.01;
              return (
                <g key={i}>
                  <line x1={ML} x2={ML + PW} y1={y.toFixed(1)} y2={y.toFixed(1)}
                    stroke={isZero ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}
                    strokeWidth={isZero ? "0.8" : "0.5"}
                    strokeDasharray={isZero ? undefined : "3 3"} />
                  <text x={(ML - 5).toFixed(0)} y={y.toFixed(1)} textAnchor="end" dominantBaseline="middle"
                    fill="rgba(255,255,255,0.35)" fontSize="8">
                    {v === 0 ? "$0" : fmtMoney(Math.round(v))}
                  </text>
                </g>
              );
            })}

            {/* X axis line */}
            <line x1={ML} x2={ML + PW} y1={SVG_H - MB} y2={SVG_H - MB} stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />

            {/* Y axis line */}
            <line x1={ML} x2={ML} y1={MT} y2={SVG_H - MB} stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />

            {/* X axis date labels */}
            {xLabels.map(({ x, label }, i) => (
              <text key={i} x={x.toFixed(1)} y={(SVG_H - MB + 14).toFixed(0)} textAnchor="middle"
                fill="rgba(255,255,255,0.35)" fontSize="8">{label}</text>
            ))}

            {/* Revenue line */}
            <path d={makePath(points.map((p) => p.revenueCents))} fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            {/* Expenses line */}
            <path d={makePath(points.map((p) => p.expenseCents))} fill="none" stroke="#f87171" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            {/* Profit line (dashed) */}
            <path d={makePath(points.map((p) => p.profitCents))} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 2" />
          </svg>
        )}
      </div>

      {/* Legend */}
      {n > 0 && (
        <div className="mt-3 flex flex-wrap gap-5 text-xs">
          {[
            { color: "#34d399", label: "Revenue", dashed: false },
            { color: "#f87171", label: "Expenses", dashed: false },
            { color: "rgba(255,255,255,0.75)", label: "Profit", dashed: true },
          ].map(({ color, label, dashed }) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="22" height="10" className="shrink-0">
                <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 2" : undefined} />
              </svg>
              <span className="text-white/50">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Contact Section ──────────────────────────────────────────────────────────

function ContactSection({ customer, jobId, jobDoc, tenantId, onCustomerUpdated, onDocUpdated }: {
  customer: Customer | null;
  jobId: number;
  jobDoc: JobDocument | null;
  tenantId: string;
  onCustomerUpdated: (c: Customer) => void;
  onDocUpdated: (u: Partial<JobDocument>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
    notes: customer?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25";

  function startEdit() {
    setForm({ name: customer?.name || "", phone: customer?.phone || "", email: customer?.email || "", address: customer?.address || "", notes: customer?.notes || "" });
    setEditing(true);
  }

  async function save() {
    if (!form.name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr(null);
    try {
      let custId = customer?.id;
      if (custId) {
        await supabase.from("customers").update({ name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null }).eq("id", custId);
      } else {
        const { data } = await supabase.from("customers").insert({ tenant_id: tenantId, name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null }).select("id, name, phone, email, address, notes").single();
        if (data) custId = data.id;
      }
      if (custId) {
        // Ensure job_documents record exists and is linked
        if (jobDoc?.id) {
          await supabase.from("job_documents").update({ customer_id: custId }).eq("id", jobDoc.id);
        } else {
          const { data: jdData } = await supabase.from("job_documents").insert({ tenant_id: tenantId, job_id: jobId, stage: "lead", customer_id: custId }).select("id, stage, lead_notes, lead_source, customer_id").single();
          if (jdData) onDocUpdated(jdData);
        }
        onCustomerUpdated({ id: custId, name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null });
      }
      setEditing(false);
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing && customer) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Client</div>
          <button type="button" onClick={startEdit} className="text-xs text-white/40 hover:text-white/70 transition">Edit</button>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-base font-semibold text-white/90">{customer.name}</div>
          {customer.phone && <div className="text-sm text-white/55">{customer.phone}</div>}
          {customer.email && <div className="text-sm text-white/55">{customer.email}</div>}
          {customer.address && <div className="text-sm text-white/45 mt-1">{customer.address}</div>}
          {customer.notes && (
            <div className="mt-2 border-t border-white/8 pt-2 text-sm text-white/40 italic">{customer.notes}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">{customer ? "Edit client" : "Add client"}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-white/50">Name *</label>
          <input type="text" placeholder="e.g. John Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Phone</label>
          <input type="tel" placeholder="e.g. 519-555-0100" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-white/50">Email</label>
          <input type="email" placeholder="e.g. john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-white/50">Address</label>
          <input type="text" placeholder="e.g. 349 Brock St, London, ON N6P 1A1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-white/50">Notes</label>
          <textarea rows={3} placeholder="Anything worth remembering about this client…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputCls} resize-none`} />
        </div>
      </div>
      {err && <div className="text-xs text-red-300">{err}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">
          {saving ? "Saving…" : "Save client"}
        </button>
        {customer && (
          <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10">Cancel</button>
        )}
      </div>
    </div>
  );
}

// ─── Overhead helpers ─────────────────────────────────────────────────────────

type OverheadRow = {
  item_type: string;
  amount_cents: number;
  frequency: string;
  amortization_months: number | null;
};

function monthlyEquivalent(item: OverheadRow): number {
  if (item.item_type === "amortized") {
    return item.amortization_months
      ? Math.round(item.amount_cents / item.amortization_months)
      : 0;
  }
  if (item.frequency === "weekly") return Math.round((item.amount_cents * 52) / 12);
  if (item.frequency === "annual") return Math.round(item.amount_cents / 12);
  return item.amount_cents;
}

// ─── Budget forms shared helper ───────────────────────────────────────────────

function BudgetCard({ label, currentCents, currentHours, fieldType, jobId, onSaved }: {
  label: string;
  currentCents?: number | null;
  currentHours?: number | null;
  fieldType: "material_budget_cents" | "contract_value_cents" | "labour_hours_budget";
  jobId: number;
  onSaved: (v: number | null) => void;
}) {
  const isHours = fieldType === "labour_hours_budget";
  const current = isHours ? currentHours : currentCents;
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current != null ? (isHours ? String(current) : String(current / 100)) : "");
  const [saving, setSaving] = useState(false);
  const inputCls = "rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 w-full";

  async function save() {
    setSaving(true);
    const parsed = val.trim() ? parseFloat(val) : NaN;
    const dbVal = val.trim() ? (isHours ? parsed : Math.round(parsed * 100)) : null;
    if (!isNaN(parsed) || !val.trim()) {
      await supabase.from("jobs").update({ [fieldType]: dbVal }).eq("id", jobId);
      onSaved(dbVal);
      setOpen(false);
    }
    setSaving(false);
  }

  const displayVal = current != null
    ? (isHours ? fmtHours(current) : fmtMoney(current))
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</div>
          <div className="mt-1 text-base font-semibold text-white/85">
            {displayVal ?? <span className="text-white/30 text-sm italic font-normal">Not set</span>}
          </div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition">
          {displayVal ? "Edit" : "Set budget"}
        </button>
      </div>
      {open && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/8 pt-4">
          <div className="flex-1 min-w-36">
            <label className="mb-1 block text-[11px] text-white/50">{isHours ? "Hours" : "Amount ($)"}</label>
            <input type="number" min="0" step={isHours ? "0.5" : "0.01"}
              placeholder={isHours ? "e.g. 120" : "e.g. 8000"}
              value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} />
          </div>
          <button type="button" onClick={save} disabled={saving}
            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 hover:bg-white/10">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Simple data tabs ─────────────────────────────────────────────────────────

function ExpensesTab({ job, onJobUpdated }: { job: JobRow; onJobUpdated: (u: Partial<JobRow>) => void }) {
  const jobName = String(job.job_name || job.name || "").trim();
  const [monthlyOverhead, setMonthlyOverhead] = useState<number | null>(null);
  const [activeJobCount, setActiveJobCount] = useState<number>(1);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const userId = u?.user?.id;
        if (!userId) return;
        const { data: pu } = await supabase.from("chiefos_portal_users").select("tenant_id").eq("user_id", userId).maybeSingle();
        const tenantId = (pu as any)?.tenant_id as string | null;
        if (!tenantId) return;

        const [overheadRes, jobsRes] = await Promise.all([
          supabase.from("overhead_items").select("item_type, amount_cents, frequency, amortization_months").eq("tenant_id", tenantId).eq("active", true),
          supabase.from("jobs").select("id, status, active").limit(500),
        ]);

        const total = ((overheadRes.data as OverheadRow[]) || []).reduce(
          (sum, item) => sum + monthlyEquivalent(item), 0
        );
        setMonthlyOverhead(total);

        const activeCount = ((jobsRes.data as any[]) || []).filter((j: any) => {
          const s = String(j.status || "").toLowerCase();
          return j.active || s === "active" || s === "open" || s.includes("active");
        }).length;
        setActiveJobCount(Math.max(1, activeCount));
      } catch {
        // fail-soft
      }
    })();
  }, []);

  const allocationPerJob = monthlyOverhead !== null && activeJobCount > 0
    ? Math.round(monthlyOverhead / activeJobCount)
    : null;

  return (
    <div className="space-y-4">
      <BudgetCard label="Materials budget" currentCents={job.material_budget_cents} fieldType="material_budget_cents" jobId={job.id}
        onSaved={(v) => onJobUpdated({ material_budget_cents: v })} />

      {/* Overhead allocation card */}
      {monthlyOverhead !== null && (
        monthlyOverhead > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Overhead allocation</div>
            <div className="text-sm text-white/70 mt-2">
              <span className="text-white font-medium">
                {(monthlyOverhead / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/mo
              </span>
              {" fixed ÷ "}
              <span className="text-white font-medium">{activeJobCount}</span>
              {" active job" + (activeJobCount !== 1 ? "s" : "") + " = "}
              <span className="text-amber-400 font-semibold">
                ~{(allocationPerJob! / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })} per job
              </span>
            </div>
            <p className="text-xs text-white/40">Add this to your job costs for a true margin view.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-sm text-white/40">
              No overhead set —{" "}
              <a href="/app/overhead" className="text-white/60 underline underline-offset-2 hover:text-white transition">
                add fixed costs
              </a>
              {" "}to see your true job margin.
            </p>
          </div>
        )
      )}

      <DashboardDataPanel view="expenses" selectedJobName={jobName || null} />
    </div>
  );
}

function RevenueTab({ job, onJobUpdated }: { job: JobRow; onJobUpdated: (u: Partial<JobRow>) => void }) {
  const jobName = String(job.job_name || job.name || "").trim();
  return (
    <div className="space-y-4">
      <BudgetCard label="Contract value" currentCents={job.contract_value_cents} fieldType="contract_value_cents" jobId={job.id}
        onSaved={(v) => onJobUpdated({ contract_value_cents: v })} />
      <DashboardDataPanel view="revenue" selectedJobName={jobName || null} />
    </div>
  );
}

function TimeClockTab({ job, onJobUpdated }: { job: JobRow; onJobUpdated: (u: Partial<JobRow>) => void }) {
  const jobName = String(job.job_name || job.name || "").trim();
  return (
    <div className="space-y-4">
      <BudgetCard label="Labour hours budget" currentHours={job.labour_hours_budget} fieldType="labour_hours_budget" jobId={job.id}
        onSaved={(v) => onJobUpdated({ labour_hours_budget: v })} />
      <DashboardDataPanel view="time" selectedJobName={jobName || null} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const VALID_TABS: Tab[] = ["expenses", "revenue", "timeclock", "tasks", "reminders", "documents", "photos"];

export default function JobDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const jobId = Number(params.jobId);
  const { loading: gateLoading, tenantId } = useTenantGate({ requireWhatsApp: false });

  const [job, setJob] = useState<JobRow | null>(null);
  const [jobDoc, setJobDoc] = useState<JobDocument | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quoteLines, setQuoteLines] = useState<QuoteLineItem[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [documentFiles, setDocumentFiles] = useState<JobDocumentFile[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const initialTab = VALID_TABS.includes(searchParams.get("tab") as Tab)
    ? (searchParams.get("tab") as Tab)
    : "expenses";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || isNaN(jobId)) return;
    setLoading(true);
    try {
      const { data: jobData } = await supabase.from("jobs").select("id, job_no, job_name, name, status, active, start_date, end_date, material_budget_cents, labour_hours_budget, contract_value_cents").eq("id", jobId).single();
      if (!jobData) { setNotFound(true); setLoading(false); return; }
      setJob(jobData as JobRow);

      const { data: tenantRes } = await supabase.from("chiefos_tenants").select("business_name, name, company_name").eq("id", tenantId).maybeSingle();
      setBusinessName(tenantRes?.business_name || tenantRes?.company_name || tenantRes?.name || "");

      const { data: docData } = await supabase.from("job_documents").select("id, stage, lead_notes, lead_source, customer_id").eq("job_id", jobId).maybeSingle();
      if (docData) {
        setJobDoc(docData as JobDocument);
        if (docData.customer_id) {
          const { data: custData } = await supabase.from("customers").select("id, name, phone, email, address, notes").eq("id", docData.customer_id).single();
          if (custData) setCustomer(custData as Customer);
        }
      }

      const [linesRes, coRes, filesRes] = await Promise.all([
        supabase.from("quote_line_items").select("id, description, qty, unit_price_cents, category, sort_order").eq("job_id", jobId).order("sort_order"),
        supabase.from("change_orders").select("id, number, description, amount_cents, approved_at, file_id").eq("job_id", jobId).order("number"),
        supabase.from("job_document_files").select("id, kind, label, storage_bucket, storage_path, signature_token, signed_at, sent_at, sent_via, created_at").eq("job_id", jobId).order("created_at", { ascending: false }),
      ]);
      setQuoteLines((linesRes.data as QuoteLineItem[]) || []);
      setChangeOrders((coRes.data as ChangeOrder[]) || []);
      setDocumentFiles((filesRes.data as JobDocumentFile[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [jobId, tenantId]);

  useEffect(() => {
    if (!gateLoading && tenantId) void load();
  }, [gateLoading, tenantId, load]);

  if (gateLoading || loading) return <div className="p-8 text-sm text-white/60">Loading…</div>;
  if (notFound || !job) return <div className="p-8 text-center"><div className="text-white/60 mb-4">Job not found.</div><Link href="/app/jobs" className="text-sm text-white/50 underline">← Back to jobs</Link></div>;

  const title = String(job.job_name || job.name || "Untitled job");
  const tabs: { key: Tab; label: string }[] = [
    { key: "expenses", label: "Expenses" },
    { key: "revenue", label: "Revenue" },
    { key: "timeclock", label: "Time Clock" },
    { key: "tasks", label: "Tasks" },
    { key: "reminders", label: "Reminders" },
    { key: "documents", label: "Documents" },
    { key: "photos", label: "Photos" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6"><Link href="/app/jobs" className="text-[11px] text-white/40 hover:text-white/60 transition">← All jobs</Link></div>
        {/* Header */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Job</div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white/95">{title}</h1>
          {(job.start_date || job.end_date) && (
            <div className="mt-1 text-sm text-white/40">
              {job.start_date && <span>Started {new Date(job.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
              {job.end_date && <span> · Ends {new Date(job.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
            </div>
          )}
        </div>

        {/* Performance chart — always visible */}
        <JobPerformanceChart jobId={job.id} />

        {/* Contact information */}
        {tenantId && (
          <div className="mt-5">
            <ContactSection
              customer={customer} jobId={job.id} jobDoc={jobDoc} tenantId={tenantId}
              onCustomerUpdated={setCustomer}
              onDocUpdated={(u) => setJobDoc((d) => d ? { ...d, ...u } : { id: "", stage: "lead", lead_notes: null, lead_source: null, customer_id: null, ...u })}
            />
          </div>
        )}

        {/* Tab bar */}
        <div className="mt-6 overflow-x-auto">
          <div className="flex gap-1 border-b border-white/10 min-w-max">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={["px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px whitespace-nowrap",
                  tab === t.key ? "border-white text-white" : "border-transparent text-white/45 hover:text-white/70",
                ].join(" ")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {tab === "expenses" && (
            <ExpensesTab job={job} onJobUpdated={(u) => setJob((j) => j ? { ...j, ...u } : j)} />
          )}
          {tab === "revenue" && (
            <RevenueTab job={job} onJobUpdated={(u) => setJob((j) => j ? { ...j, ...u } : j)} />
          )}
          {tab === "timeclock" && (
            <TimeClockTab job={job} onJobUpdated={(u) => setJob((j) => j ? { ...j, ...u } : j)} />
          )}
          {tab === "tasks" && (
            <DashboardDataPanel view="tasks" selectedJobName={String(job.job_name || job.name || "").trim() || null} />
          )}
          {tab === "reminders" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <div className="text-sm text-white/50">Reminders coming soon. Set follow-up reminders for this job.</div>
            </div>
          )}
          {tab === "documents" && tenantId && (
            <DocumentsTab
              job={job} jobDoc={jobDoc} customer={customer} quoteLines={quoteLines}
              changeOrders={changeOrders} documentFiles={documentFiles} tenantId={tenantId} businessName={businessName}
              onDocUpdated={(u) => setJobDoc((d) => d ? { ...d, ...u } : { id: "", stage: "lead", lead_notes: null, lead_source: null, customer_id: null, ...u })}
              onCustomerUpdated={setCustomer}
              onQuoteLinesUpdated={setQuoteLines}
              onChangeOrdersUpdated={setChangeOrders}
              onDocFileAdded={(f) => setDocumentFiles((prev) => [f, ...prev])}
              onJobUpdated={(u) => setJob((j) => j ? { ...j, ...u } : j)}
            />
          )}
          {tab === "photos" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <div className="text-sm text-white/50">Photo gallery coming soon. Job-site photos sent via WhatsApp will appear here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
