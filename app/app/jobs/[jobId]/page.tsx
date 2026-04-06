"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { useTenantGate } from "@/lib/useTenantGate";
import { type PulsePoint } from "@/app/app/components/BusinessPulseChart";
import DashboardDataPanel from "@/app/app/components/DashboardDataPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseRow = {
  id: string;
  phase_name: string;
  started_at: string;
  ended_at: string | null;
  expires_at: string | null;
  expense_cents: number;
  revenue_cents: number;
};

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

  // ── Catalog modal state
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);

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

  async function searchCatalog(q: string) {
    if (!q.trim()) return;
    setCatalogLoading(true); setCatalogErr(null);
    try {
      const tok = await getBearerToken();
      const res = await fetch(`/api/catalog/products/search?q=${encodeURIComponent(q.trim())}&limit=10`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      if (!res.ok) { setCatalogErr(data?.error?.message || "Search failed."); setCatalogResults([]); }
      else setCatalogResults(data.products ?? []);
    } catch { setCatalogErr("Search failed."); setCatalogResults([]); }
    finally { setCatalogLoading(false); }
  }

  function pickCatalogProduct(p: any) {
    // Pre-fill the manual line item form with catalog data
    setNewDesc(p.name || "");
    setNewQty("1");
    setNewPrice(((p.unit_price_cents || 0) / 100).toFixed(2));
    setNewCat("materials");
    setCatalogOpen(false);
    setCatalogQuery("");
    setCatalogResults([]);
    setAddingLine(true);
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
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddingLine(true)} className="flex-1 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-xs font-medium text-white/50 hover:border-white/25 hover:text-white/70 transition text-center">+ Add line item</button>
              <button type="button" onClick={() => { setCatalogOpen(true); setCatalogErr(null); setCatalogResults([]); setCatalogQuery(""); }} className="rounded-xl border border-dashed border-indigo-500/30 px-4 py-2.5 text-xs font-medium text-indigo-400/70 hover:border-indigo-400/50 hover:text-indigo-300 transition whitespace-nowrap">+ From catalog</button>
            </div>
          )}

          {/* Catalog search modal */}
          {catalogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e0e10] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div>
                    <div className="text-sm font-semibold text-white/90">Supplier Catalog</div>
                    <div className="text-xs text-white/40 mt-0.5">Search for materials and add to quote</div>
                  </div>
                  <button type="button" onClick={() => setCatalogOpen(false)} className="text-white/30 hover:text-white/60 transition text-lg leading-none">✕</button>
                </div>
                <div className="p-5 space-y-4">
                  <form onSubmit={(e) => { e.preventDefault(); searchCatalog(catalogQuery); }} className="flex gap-2">
                    <input
                      autoFocus
                      value={catalogQuery}
                      onChange={(e) => setCatalogQuery(e.target.value)}
                      placeholder="Search products (e.g. vinyl siding, J-channel)…"
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 outline-none focus:border-white/20"
                    />
                    <button type="submit" disabled={catalogLoading} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/[0.09] disabled:opacity-50 transition">
                      {catalogLoading ? "…" : "Search"}
                    </button>
                  </form>

                  {catalogErr && <div className="text-xs text-red-300">{catalogErr}</div>}

                  {catalogResults.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {catalogResults.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickCatalogProduct(p)}
                          className="w-full rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15 transition px-4 py-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white/85 leading-snug truncate">{p.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {p.sku && <span className="text-[10px] font-mono text-white/35">{p.sku}</span>}
                                {p.supplier_name && <span className="text-[10px] text-white/35">{p.supplier_name}</span>}
                                {p.category_name && <span className="text-[10px] text-white/30">{p.category_name}</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold text-white/80">
                                {p.unit_price_cents != null ? `$${(p.unit_price_cents / 100).toFixed(2)}` : "—"}
                              </div>
                              <div className="text-[10px] text-white/35">{p.unit_of_measure || ""}</div>
                            </div>
                          </div>
                          {p.price_effective_date && (
                            <div className="mt-1.5 text-[10px] text-white/25 italic">
                              Pricing as of {new Date(p.price_effective_date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {!catalogLoading && catalogResults.length === 0 && catalogQuery && !catalogErr && (
                    <div className="text-sm text-white/35 text-center py-4">No products found for "{catalogQuery}".</div>
                  )}
                </div>
              </div>
            </div>
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

      <InlineLogButton job={job} type="expense" label="Log Expense" onDone={() => {}} />
      <InlineLogButton job={job} type="receipt" label="Upload Receipt" onDone={() => {}} />
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
      <InlineLogButton job={job} type="revenue" label="Log Revenue" onDone={() => {}} />
      <DashboardDataPanel view="revenue" selectedJobName={jobName || null} />
    </div>
  );
}

// ─── InlineLogButton ──────────────────────────────────────────────────────────
// Thin collapsible form for logging directly inside any tab

type InlineLogType = "expense" | "revenue" | "hours" | "task" | "reminder" | "receipt";

function InlineLogButton({ job, type, label, onDone }: {
  job: JobRow; type: InlineLogType; label: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);

  const labelIcons: Record<InlineLogType, string> = {
    expense: "💸", revenue: "💰", hours: "⏱", task: "✅", reminder: "🔔", receipt: "📷",
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition",
          open
            ? "border-white/20 bg-white/8 text-white"
            : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          <span>{labelIcons[type]}</span>
          <span>{label}</span>
        </span>
        <span className="text-[10px] text-white/30">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-[20px] border border-white/10 bg-black/40 p-5">
          {type === "expense" && (
            <JobExpenseForm job={job} onDone={() => { setOpen(false); onDone(); }} />
          )}
          {type === "receipt" && (
            <JobReceiptForm job={job} onDone={() => { setOpen(false); onDone(); }} onCancel={() => setOpen(false)} />
          )}
          {type === "revenue" && (
            <JobRevenueForm job={job} onDone={() => { setOpen(false); onDone(); }} />
          )}
          {type === "hours" && (
            <JobHoursForm job={job} onDone={() => { setOpen(false); onDone(); }} />
          )}
          {type === "task" && (
            <JobTaskForm job={job} onDone={() => { setOpen(false); onDone(); }} />
          )}
          {type === "reminder" && (
            <JobReminderForm onDone={() => { setOpen(false); onDone(); }} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Photos Tab ───────────────────────────────────────────────────────────────

type JobPhoto = {
  id: string;
  description: string | null;
  public_url: string;
  storage_path: string;
  source: string;
  created_at: string;
};

function PhotosTab({ job, tenantId }: { job: JobRow; tenantId: string }) {
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobPhoto | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadPhotos() {
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      const r = await fetch(`/api/jobs/${job.id}/photos`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const j = await r.json();
        setPhotos((j.photos as JobPhoto[]) || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { void loadPhotos(); }, [job.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${tenantId}/${job.id}/${Date.now()}.${ext}`;

      // Upload directly to Supabase Storage from the browser
      const { error: uploadError } = await supabase.storage
        .from("job-photos")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL
      const { data: urlData } = supabase.storage.from("job-photos").getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl || "";

      // Record in backend
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      const r = await fetch(`/api/jobs/${job.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storagePath, publicUrl, description: description.trim() || null }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.message || "Upload failed");

      setPhotos((prev) => [j.photo as JobPhoto, ...prev]);
      setDescription("");
    } catch (e: any) {
      setErr(e.message || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(photoId: string) {
    setDeletingId(photoId);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      await fetch(`/api/jobs/${job.id}/photos/${photoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (selected?.id === photoId) setSelected(null);
    } catch {}
    setDeletingId(null);
  }

  async function handleShare() {
    setSharingLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      const r = await fetch(`/api/jobs/${job.id}/photos/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (j.ok) setShareUrl(j.url);
    } catch {}
    setSharingLoading(false);
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-5">
      {/* Lightbox */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.public_url} alt={selected.description || "Job photo"} className="w-full max-h-[75vh] object-contain rounded-xl" />
            {selected.description && <div className="mt-2 text-sm text-white/70 text-center">{selected.description}</div>}
            <div className="mt-3 flex justify-center gap-3">
              <a href={selected.public_url} download className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition" onClick={(e) => e.stopPropagation()}>Download</a>
              <button type="button" onClick={() => { if (window.confirm("Delete this photo?")) handleDelete(selected.id); }} className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/15 transition">Delete</button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/60 hover:bg-white/10 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload section */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Upload Photo</div>
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25"
        />
        <div className="flex items-center gap-3">
          <label className={[
            "cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition",
            uploading
              ? "border-white/10 bg-white/5 text-white/40 pointer-events-none"
              : "border-white/20 bg-white/8 text-white/80 hover:bg-white/15",
          ].join(" ")}>
            {uploading ? "Uploading…" : "Choose photo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <span className="text-xs text-white/30">JPEG, PNG, HEIC supported</span>
        </div>
        {err && <div className="text-xs text-red-300">{err}</div>}
      </div>

      {/* Share link */}
      {photos.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-medium text-white/80">Client gallery link</div>
            <div className="text-xs text-white/40">Share all photos with your client — link valid 30 days</div>
          </div>
          {shareUrl ? (
            <div className="flex items-center gap-2">
              <input readOnly value={shareUrl} className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/70 w-64 outline-none" />
              <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} className="rounded-xl bg-white/8 border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/15 transition">Copy</button>
            </div>
          ) : (
            <button type="button" onClick={handleShare} disabled={sharingLoading} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 transition disabled:opacity-50">
              {sharingLoading ? "Generating…" : "Generate link"}
            </button>
          )}
        </div>
      )}

      {/* Photo grid */}
      {loading ? (
        <div className="text-sm text-white/40 py-6 text-center">Loading photos…</div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <div className="text-sm text-white/40">No photos yet.</div>
          <div className="mt-1 text-xs text-white/25">Upload above or send photos via WhatsApp and tag this job.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p)}
              disabled={deletingId === p.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 hover:border-white/25 transition bg-white/[0.03]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.public_url} alt={p.description || "Job photo"} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              {p.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1.5 text-[11px] text-white/80 text-left line-clamp-1">
                  {p.description}
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white/60">
                {fmtDate(p.created_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Phases Section ───────────────────────────────────────────────────────────

function PhasesSection({ jobId, phases, onPhaseRemoved }: {
  jobId: number;
  phases: PhaseRow[];
  onPhaseRemoved: (id: string) => void;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (phases.length === 0) return null;

  async function removePhase(phaseId: string) {
    setErr(null);
    setRemovingId(phaseId);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      const r = await fetch(`/api/jobs/${jobId}/phases/${phaseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.message || "Failed");
      onPhaseRemoved(phaseId);
    } catch (e: any) {
      setErr(e.message || "Could not remove phase.");
    } finally {
      setRemovingId(null);
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const now = new Date();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/8">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Phases</div>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {phases.map((p) => {
          const isActive = !p.ended_at || new Date(p.ended_at) > now;
          const expiresSoon = p.expires_at && new Date(p.expires_at) > now;
          return (
            <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white/85">{p.phase_name}</span>
                  {isActive && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      {expiresSoon ? "Active · clears tonight" : "Active"}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-white/40">
                  {fmtDate(p.started_at)}
                  {p.ended_at ? ` → ${fmtDate(p.ended_at)}` : " → ongoing"}
                  {(p.expense_cents > 0 || p.revenue_cents > 0) && (
                    <span className="ml-2 text-white/30">
                      {p.expense_cents > 0 && `$${(p.expense_cents / 100).toFixed(0)} expenses`}
                      {p.expense_cents > 0 && p.revenue_cents > 0 && " · "}
                      {p.revenue_cents > 0 && `$${(p.revenue_cents / 100).toFixed(0)} revenue`}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removePhase(p.id)}
                disabled={removingId !== null}
                className="shrink-0 rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-medium text-white/35 hover:border-red-500/30 hover:text-red-400/70 transition disabled:opacity-40"
              >
                {removingId === p.id ? "…" : "Remove"}
              </button>
            </div>
          );
        })}
      </div>
      {err && (
        <div className="px-5 py-2 text-xs text-red-300 border-t border-white/8">{err}</div>
      )}
    </div>
  );
}

function TimeClockTab({ job, onJobUpdated }: { job: JobRow; onJobUpdated: (u: Partial<JobRow>) => void }) {
  const jobName = String(job.job_name || job.name || "").trim();
  return (
    <div className="space-y-4">
      <BudgetCard label="Labour hours budget" currentHours={job.labour_hours_budget} fieldType="labour_hours_budget" jobId={job.id}
        onSaved={(v) => onJobUpdated({ labour_hours_budget: v })} />
      <InlineLogButton job={job} type="hours" label="Log Hours" onDone={() => {}} />
      <DashboardDataPanel view="time" selectedJobName={jobName || null} />
    </div>
  );
}

// ─── Job Log Tab ──────────────────────────────────────────────────────────────

const logInp = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/30";
const logLbl = "mb-1 block text-[11px] text-white/50";
const logToday = () => new Date().toISOString().slice(0, 10);

type LogCardType = "receipt" | "expense" | "revenue" | "hours" | "task" | "reminder";
type LogLineItem = { description: string; sku: string | null; quantity: number | null; unitPrice: string | null; amount: string };
type LogLineItemForm = { description: string; amountCents: string };
type LogReceiptItemForm = { vendor: string; amount: string; date: string; description: string; draft_type: string; subtotalCents: string; taxCents: string; taxLabel: string };
type LogIntakeItem = { id: string; batch_id: string; kind: string; status: string; source_filename: string | null; draft_type: string | null; confidence_score: number | null; created_at: string; draft_amount_cents?: number | null; draft_currency?: string | null; draft_vendor?: string | null; draft_description?: string | null; draft_event_date?: string | null; draft_job_name?: string | null; draft_validation_flags?: string[]; fast_confirm_ready?: boolean; draft_subtotal_cents?: number | null; draft_tax_cents?: number | null; draft_tax_label?: string | null; draft_line_items?: LogLineItem[] | null };

const LOG_CARDS: { type: LogCardType; label: string; icon: string }[] = [
  { type: "receipt",  label: "Receipt / File", icon: "📷" },
  { type: "expense",  label: "Expense",        icon: "💸" },
  { type: "revenue",  label: "Revenue",        icon: "💰" },
  { type: "hours",    label: "Labour Hours",   icon: "⏱" },
  { type: "task",     label: "Task",           icon: "✅" },
  { type: "reminder", label: "Reminder",       icon: "🔔" },
];

function LogZoomableImage({ src }: { src: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const lastPinch = useRef<number | null>(null);

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const maxX = (el.clientWidth * (s - 1)) / 2;
    const maxY = (el.clientHeight * (s - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  const doZoom = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.max(1, Math.min(5, prev + delta));
      if (next === prev) return prev;
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); doZoom(e.deltaY < 0 ? 0.3 : -0.3); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [doZoom]);

  const onMouseDown = (e: React.MouseEvent) => { if (scale <= 1) return; drag.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y }; };
  const onMouseMove = (e: React.MouseEvent) => { if (!drag.current) return; setOffset(clampOffset(drag.current.ox + (e.clientX - drag.current.startX), drag.current.oy + (e.clientY - drag.current.startY), scale)); };
  const onMouseUp = () => { drag.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastPinch.current = Math.sqrt(dx * dx + dy * dy); }
    else if (e.touches.length === 1 && scale > 1) { drag.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, ox: offset.x, oy: offset.y }; }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinch.current !== null) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.sqrt(dx * dx + dy * dy); doZoom((dist - lastPinch.current) * 0.02); lastPinch.current = dist; }
    else if (e.touches.length === 1 && drag.current) { setOffset(clampOffset(drag.current.ox + (e.touches[0].clientX - drag.current.startX), drag.current.oy + (e.touches[0].clientY - drag.current.startY), scale)); }
  };
  const onTouchEnd = () => { drag.current = null; lastPinch.current = null; };

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30" style={{ height: "288px", cursor: scale > 1 ? "grab" : "zoom-in", touchAction: "none" }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onDoubleClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Receipt preview" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`, transformOrigin: "center center", transition: drag.current ? "none" : "transform 0.1s ease", userSelect: "none" }} />
      <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/60 pointer-events-none">
        {scale > 1 ? `${Math.round(scale * 100)}% · double-tap to reset` : "scroll or pinch to zoom"}
      </div>
    </div>
  );
}

function JobReceiptForm({ job, onDone, onCancel }: { job: JobRow; onDone: () => void; onCancel: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "fetching" | "review" | "confirming" | "confirmed" | "error">("idle");
  const [items, setItems] = useState<LogIntakeItem[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [forceIds, setForceIds] = useState<Set<string>>(new Set());
  const [forms, setForms] = useState<Record<string, LogReceiptItemForm>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [splitModes, setSplitModes] = useState<Record<string, boolean>>({});
  const [lineItemForms, setLineItemForms] = useState<Record<string, LogLineItemForm[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const busy = ["uploading", "processing", "fetching", "confirming"].includes(phase);

  async function authToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function upload() {
    try {
      setPhase("uploading"); setErr(null);
      const token = await authToken();
      if (!token || !files.length) throw new Error("No files selected.");
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const upRes = await fetch("/api/intake/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upJson?.ok) throw new Error(upJson?.error || "Upload failed.");

      setPhase("processing");
      const prRes = await fetch("/api/intake/process", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ batchId: upJson.batchId }) });
      const prJson = await prRes.json().catch(() => ({}));
      if (!prRes.ok || !prJson?.ok) throw new Error(prJson?.error || "Processing failed.");

      setPhase("fetching");
      const iRes = await fetch(`/api/intake/items?batchId=${encodeURIComponent(upJson.batchId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const iJson = await iRes.json().catch(() => ({}));
      const fetchedItems: LogIntakeItem[] = Array.isArray(iJson.rows) ? iJson.rows : [];

      const jobName = job.job_name || job.name || "";
      const initialForms: Record<string, LogReceiptItemForm> = {};
      for (const item of fetchedItems) {
        initialForms[item.id] = {
          vendor: item.draft_vendor || "",
          amount: item.draft_amount_cents != null ? (item.draft_amount_cents / 100).toFixed(2) : "",
          date: item.draft_event_date || logToday(),
          description: item.draft_description || "",
          draft_type: item.draft_type || "expense",
          subtotalCents: item.draft_subtotal_cents != null ? (item.draft_subtotal_cents / 100).toFixed(2) : "",
          taxCents: item.draft_tax_cents != null ? (item.draft_tax_cents / 100).toFixed(2) : "",
          taxLabel: item.draft_tax_label || "",
        };
      }
      const newPreviews: Record<string, string> = {};
      files.forEach((f) => { if (f.type.startsWith("image/")) newPreviews[f.name] = URL.createObjectURL(f); });
      setPreviews(newPreviews);
      setItems(fetchedItems);
      setForms(initialForms);
      setConfirmedIds(new Set());
      setForceIds(new Set());
      setFiles([]);

      const initialLineItemForms: Record<string, LogLineItemForm[]> = {};
      for (const item of fetchedItems) {
        const rawLines: LogLineItem[] = Array.isArray(item.draft_line_items) ? item.draft_line_items : [];
        if (rawLines.length > 0) {
          initialLineItemForms[item.id] = rawLines.map((li) => ({ description: li.description || "", amountCents: li.amount ? parseFloat(li.amount).toFixed(2) : "" }));
        }
      }
      setLineItemForms(initialLineItemForms);
      setSplitModes({});
      setPhase("review");
    } catch (e: any) {
      setErr(e?.message || "Upload failed.");
      setPhase("error");
    }
  }

  function updateForm(itemId: string, key: keyof LogReceiptItemForm, value: string) {
    setForms((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [key]: value } }));
  }

  async function confirmItem(item: LogIntakeItem, force = false) {
    const f = forms[item.id];
    if (!f) return;
    const jobName = job.job_name || job.name || "";
    const jobId = job.id;
    const isSplit = splitModes[item.id] && (lineItemForms[item.id]?.length ?? 0) > 0;

    if (isSplit) {
      const liRows = lineItemForms[item.id] || [];
      const hasAmounts = liRows.every((li) => parseFloat(li.amountCents || "0") > 0);
      if (!hasAmounts) { setErr("Each line item needs a valid amount."); return; }
      setPhase("confirming"); setErr(null);
      try {
        const token = await authToken();
        const r = await fetch(`/api/intake/items/${item.id}/confirm`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ draftType: "expense", vendor: f.vendor || null, eventDate: f.date || null, currency: "CAD", force,
            lineItems: liRows.map((li) => ({ description: li.description, amountCents: Math.round(parseFloat(li.amountCents || "0") * 100), jobName, jobId })) }),
        });
        const j = await r.json();
        if (!j.ok) { if (j.code === "BLOCKING_FLAGS") setForceIds((prev) => new Set([...prev, item.id])); throw new Error(j.error || "Confirm failed."); }
        const newConfirmed = new Set([...confirmedIds, item.id]);
        setConfirmedIds(newConfirmed);
        if (items.every((i) => newConfirmed.has(i.id))) { setPhase("confirmed"); } else { setPhase("review"); }
      } catch (e: any) { setErr(e?.message || "Confirm failed."); setPhase("review"); }
      return;
    }

    const amountCents = Math.round(parseFloat(f.amount || "0") * 100);
    if (!amountCents || amountCents <= 0) { setErr("Enter a valid amount."); return; }
    setPhase("confirming"); setErr(null);
    try {
      const token = await authToken();
      const r = await fetch(`/api/intake/items/${item.id}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ draftType: f.draft_type || "expense", amountCents, vendor: f.vendor || null, eventDate: f.date || null, description: f.description || null, jobName, jobId, taxAmountCents: f.taxCents ? Math.round(parseFloat(f.taxCents) * 100) : null, subtotalAmountCents: f.subtotalCents ? Math.round(parseFloat(f.subtotalCents) * 100) : null, taxLabel: f.taxLabel || null, force }),
      });
      const j = await r.json();
      if (!j.ok) { if (j.code === "BLOCKING_FLAGS") setForceIds((prev) => new Set([...prev, item.id])); throw new Error(j.error || "Confirm failed."); }
      const newConfirmed = new Set([...confirmedIds, item.id]);
      setConfirmedIds(newConfirmed);
      if (items.every((i) => newConfirmed.has(i.id))) { setPhase("confirmed"); } else { setPhase("review"); }
    } catch (e: any) { setErr(e?.message || "Confirm failed."); setPhase("review"); }
  }

  function reset() {
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    setPhase("idle"); setItems([]); setForms({});
    setConfirmedIds(new Set()); setForceIds(new Set()); setPreviews({});
    setLineItemForms({}); setSplitModes({});
  }

  if (phase === "confirmed") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        <div className="font-semibold text-emerald-300">All receipts logged ✓</div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={reset} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Upload more</button>
          <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View Expenses →</button>
        </div>
      </div>
    );
  }

  if (phase === "review" || (phase === "confirming" && items.length > 0)) {
    return (
      <div className="space-y-4">
        {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
        {items.map((item) => {
          const f = forms[item.id] || {} as LogReceiptItemForm;
          const isConfirmed = confirmedIds.has(item.id);
          const canForce = forceIds.has(item.id);
          const flags = Array.isArray(item.draft_validation_flags) ? item.draft_validation_flags.filter(Boolean) : [];
          const previewUrl = previews[item.source_filename || ""] || null;
          const noDataExtracted = !f.vendor && !f.amount && !f.date;
          return (
            <div key={item.id} className={["rounded-2xl border p-4 space-y-3 transition", isConfirmed ? "border-emerald-500/20 bg-emerald-500/5 opacity-60" : "border-white/10 bg-black/30"].join(" ")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-white/50 truncate">{item.source_filename || "Receipt"}</div>
                  {flags.length > 0 && <div className="mt-0.5 text-[10px] text-amber-300">{flags.join(" · ")}</div>}
                </div>
                {isConfirmed && <span className="shrink-0 text-xs font-semibold text-emerald-400">Logged ✓</span>}
              </div>

              {!isConfirmed && previewUrl && <LogZoomableImage src={previewUrl} />}

              {!isConfirmed && noDataExtracted && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                  Chief couldn't extract data automatically — fill in the details below.
                </div>
              )}

              {!isConfirmed && (
                <>
                  {(f.subtotalCents || f.taxCents) && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/60">
                      {f.subtotalCents && <span>Subtotal <span className="text-white/80">${f.subtotalCents}</span></span>}
                      {f.subtotalCents && f.taxCents && <span className="text-white/30">+</span>}
                      {f.taxCents && <span>{f.taxLabel || "Tax"} <span className="text-white/80">${f.taxCents}</span></span>}
                      {(f.subtotalCents || f.taxCents) && <span className="text-white/30">=</span>}
                      <span>Total <span className="text-white font-medium">${f.amount}</span></span>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className={logLbl}>Vendor / Payee</label><input className={logInp} value={f.vendor} onChange={(e) => updateForm(item.id, "vendor", e.target.value)} placeholder="e.g. Home Depot" /></div>
                    <div><label className={logLbl}>Amount ($) *</label><input type="number" min="0.01" step="0.01" className={logInp} value={f.amount} onChange={(e) => updateForm(item.id, "amount", e.target.value)} placeholder="0.00" /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className={logLbl}>Date</label><input type="date" className={logInp} value={f.date || logToday()} onChange={(e) => updateForm(item.id, "date", e.target.value)} /></div>
                    <div><label className={logLbl}>Type</label>
                      <select className={logInp} value={f.draft_type || "expense"} onChange={(e) => updateForm(item.id, "draft_type", e.target.value)}>
                        <option value="expense">Expense</option>
                        <option value="revenue">Revenue</option>
                      </select>
                    </div>
                  </div>

                  {(f.taxCents || f.subtotalCents) && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><label className={logLbl}>Subtotal ($)</label><input type="number" min="0" step="0.01" className={logInp} value={f.subtotalCents} onChange={(e) => updateForm(item.id, "subtotalCents", e.target.value)} placeholder="0.00" /></div>
                      <div><label className={logLbl}>Tax ($)</label><input type="number" min="0" step="0.01" className={logInp} value={f.taxCents} onChange={(e) => updateForm(item.id, "taxCents", e.target.value)} placeholder="0.00" /></div>
                      <div><label className={logLbl}>Tax Label</label><input className={logInp} value={f.taxLabel} onChange={(e) => updateForm(item.id, "taxLabel", e.target.value)} placeholder="GST/HST" /></div>
                    </div>
                  )}

                  {(lineItemForms[item.id]?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-white/70">{lineItemForms[item.id].length} line items detected</span>
                        <button type="button" onClick={() => setSplitModes((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className={["rounded-lg border px-3 py-1 text-xs font-medium transition", splitModes[item.id] ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"].join(" ")}>
                          {splitModes[item.id] ? "Splitting by line ✓" : "Log as one expense"}
                        </button>
                      </div>
                      {splitModes[item.id] ? (
                        <div className="space-y-2">
                          <p className="text-[11px] text-white/40">Each line item logs as a separate expense under this job.</p>
                          {lineItemForms[item.id].map((li, idx) => (
                            <div key={idx} className="rounded-xl border border-white/8 bg-black/20 p-3 space-y-2">
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="sm:col-span-2">
                                  <label className={logLbl}>Description</label>
                                  <input className={logInp} value={li.description} onChange={(e) => setLineItemForms((prev) => { const rows = [...(prev[item.id] || [])]; rows[idx] = { ...rows[idx], description: e.target.value }; return { ...prev, [item.id]: rows }; })} />
                                </div>
                                <div>
                                  <label className={logLbl}>Amount ($)</label>
                                  <input type="number" min="0.01" step="0.01" className={logInp} value={li.amountCents} onChange={(e) => setLineItemForms((prev) => { const rows = [...(prev[item.id] || [])]; rows[idx] = { ...rows[idx], amountCents: e.target.value }; return { ...prev, [item.id]: rows }; })} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {lineItemForms[item.id].map((li, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                              <span className="text-white/70 truncate pr-2">{li.description || "Item"}</span>
                              <span className="shrink-0 text-white/50">${li.amountCents || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div><label className={logLbl}>Notes (optional)</label><input className={logInp} value={f.description} onChange={(e) => updateForm(item.id, "description", e.target.value)} placeholder="Description or notes" /></div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canForce ? (
                      <button type="button" onClick={() => confirmItem(item, true)} disabled={busy}
                        className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-40 transition">
                        {phase === "confirming" ? "Logging…" : "Confirm anyway"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => confirmItem(item)} disabled={busy}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">
                        {phase === "confirming" ? "Logging…" : splitModes[item.id] ? `Log ${lineItemForms[item.id]?.length ?? 0} items` : "Confirm & Log"}
                      </button>
                    )}
                    <button type="button" onClick={reset} disabled={busy}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-40 transition">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
        <input type="file" multiple accept="image/*,audio/*,.pdf" disabled={busy}
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="block w-full text-sm text-white/80 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black hover:file:bg-white/90 disabled:opacity-50"
        />
        <div className="mt-2 text-xs text-white/35">Images, audio, PDFs — Chief extracts the data for you to confirm.</div>
      </div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      {phase === "processing" && <div className="text-xs text-white/50">Extracting data from your receipt…</div>}
      {phase === "fetching" && <div className="text-xs text-white/50">Loading extracted data…</div>}
      <div className="flex gap-2">
        <button type="button" onClick={upload} disabled={busy || !files.length}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">
          {phase === "uploading" ? "Uploading…" : phase === "processing" ? "Processing…" : phase === "fetching" ? "Loading…" : `Upload ${files.length ? `${files.length} file(s)` : ""}`}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-40 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

function JobLogTab({ job, onDone }: { job: JobRow; onDone: (tab: Tab) => void }) {
  const [activeCard, setActiveCard] = useState<LogCardType | null>(null);

  function selectCard(type: LogCardType) {
    setActiveCard(activeCard === type ? null : type);
  }

  return (
    <div className="space-y-5">
      {/* Job badge */}
      <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <span className="text-xs text-white/40">Logging to job:</span>
        <span className="text-sm font-semibold text-white/85">{job.job_name || job.name || `Job #${job.job_no}`}</span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {LOG_CARDS.map((card) => (
          <button key={card.type} type="button" onClick={() => selectCard(card.type)}
            className={["rounded-2xl border p-4 flex flex-col items-center gap-2 transition text-center",
              activeCard === card.type
                ? "border-white/40 bg-white/10 text-white"
                : "border-white/15 hover:border-white/30 bg-white/[0.03] text-white/65 hover:text-white hover:bg-white/[0.06]",
            ].join(" ")}>
            <span className="text-2xl">{card.icon}</span>
            <span className="text-[11px] font-medium leading-tight">{card.label}</span>
          </button>
        ))}
      </div>

      {/* Active form */}
      {activeCard && (
        <div className="rounded-[24px] border border-white/10 bg-black/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white/85">
              {LOG_CARDS.find((c) => c.type === activeCard)?.icon}{" "}
              {LOG_CARDS.find((c) => c.type === activeCard)?.label}
            </div>
            <button type="button" onClick={() => setActiveCard(null)} className="text-white/30 hover:text-white/60 transition text-sm px-1">✕</button>
          </div>

          {activeCard === "receipt" && (
            <JobReceiptForm job={job} onDone={() => { setActiveCard(null); onDone("expenses"); }} onCancel={() => setActiveCard(null)} />
          )}

          {activeCard === "expense" && (
            <JobExpenseForm job={job} onDone={() => { setActiveCard(null); onDone("expenses"); }} />
          )}

          {activeCard === "revenue" && (
            <JobRevenueForm job={job} onDone={() => { setActiveCard(null); onDone("revenue"); }} />
          )}

          {activeCard === "hours" && (
            <JobHoursForm job={job} onDone={() => { setActiveCard(null); onDone("timeclock"); }} />
          )}

          {activeCard === "task" && (
            <JobTaskForm job={job} onDone={() => { setActiveCard(null); onDone("tasks"); }} />
          )}

          {activeCard === "reminder" && (
            <JobReminderForm onDone={() => { setActiveCard(null); onDone("reminders"); }} />
          )}
        </div>
      )}

      {!activeCard && (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/35">
          Select what you want to log above.
        </div>
      )}
    </div>
  );
}

function JobExpenseForm({ job, onDone }: { job: JobRow; onDone: () => void }) {
  const jobName = job.job_name || job.name || "";
  const [f, setF] = useState({ payee: "", amount: "", date: logToday(), category: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "expense", ...f, job_name: jobName, job_id: job.id, job_no: job.job_no }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Expense logged ✓</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setDone(false); setF({ payee: "", amount: "", date: logToday(), category: "", description: "" }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Log another</button>
        <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View Expenses →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={logLbl}>Payee / Vendor</label><input className={logInp} placeholder="e.g. Home Depot" value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} /></div>
        <div><label className={logLbl}>Amount ($) *</label><input type="number" min="0.01" step="0.01" className={logInp} placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={logLbl}>Date</label><input type="date" className={logInp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><label className={logLbl}>Category</label>
          <select className={logInp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">— Select —</option>
            <option value="materials">Materials</option>
            <option value="subcontract">Subcontract</option>
            <option value="fuel">Fuel</option>
            <option value="tools">Tools / Equipment</option>
            <option value="permits">Permits / Fees</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div><label className={logLbl}>Notes (optional)</label><input className={logInp} placeholder="Description or notes" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.amount} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Log expense"}</button>
    </div>
  );
}

function JobRevenueForm({ job, onDone }: { job: JobRow; onDone: () => void }) {
  const jobName = job.job_name || job.name || "";
  const [f, setF] = useState({ amount: "", date: logToday(), description: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "revenue", ...f, job_name: jobName, job_id: job.id, job_no: job.job_no }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Revenue logged ✓</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setDone(false); setF({ amount: "", date: logToday(), description: "" }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Log another</button>
        <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View Revenue →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={logLbl}>Amount ($) *</label><input type="number" min="0.01" step="0.01" className={logInp} placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
        <div><label className={logLbl}>Date</label><input type="date" className={logInp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      </div>
      <div><label className={logLbl}>Description (optional)</label><input className={logInp} placeholder="e.g. Deposit received" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.amount} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Log revenue"}</button>
    </div>
  );
}

function JobHoursForm({ job, onDone }: { job: JobRow; onDone: () => void }) {
  const jobName = job.job_name || job.name || "";
  const [f, setF] = useState({ employee_name: "", hours: "", date: logToday() });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "hours", ...f, job_name: jobName, job_id: job.id, job_no: job.job_no }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Hours logged ✓</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setDone(false); setF({ employee_name: "", hours: "", date: logToday() }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Log more</button>
        <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View Time Clock →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={logLbl}>Employee name</label><input className={logInp} placeholder="Leave blank for yourself" value={f.employee_name} onChange={(e) => setF({ ...f, employee_name: e.target.value })} /></div>
        <div><label className={logLbl}>Hours worked *</label><input type="number" min="0.25" step="0.25" className={logInp} placeholder="e.g. 7.5" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
      </div>
      <div><label className={logLbl}>Date</label><input type="date" className={logInp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.hours} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Log hours"}</button>
    </div>
  );
}

function JobTaskForm({ job, onDone }: { job: JobRow; onDone: () => void }) {
  const jobName = job.job_name || job.name || "";
  const [f, setF] = useState({ title: "", notes: "", due_at: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "task", ...f, job_name: jobName, job_id: job.id, job_no: job.job_no }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Task created ✓</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setDone(false); setF({ title: "", notes: "", due_at: "" }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Add another</button>
        <button type="button" onClick={onDone} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 transition">View Tasks →</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div><label className={logLbl}>Title *</label><input className={logInp} placeholder="What needs to be done?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><label className={logLbl}>Due date (optional)</label><input type="datetime-local" className={logInp} value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} /></div>
      <div><label className={logLbl}>Notes (optional)</label><input className={logInp} placeholder="Additional details" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.title} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Create task"}</button>
    </div>
  );
}

function JobReminderForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ title: "", remind_at: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || "";
      const r = await fetch("/api/log", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "reminder", ...f }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
      <div className="font-semibold text-emerald-300">Reminder set ✓</div>
      <div className="mt-3">
        <button type="button" onClick={() => { setDone(false); setF({ title: "", remind_at: "" }); }} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">Set another</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div><label className={logLbl}>What to remind you about *</label><input className={logInp} placeholder="e.g. Follow up with client" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><label className={logLbl}>When *</label><input type="datetime-local" className={logInp} value={f.remind_at} onChange={(e) => setF({ ...f, remind_at: e.target.value })} /></div>
      {err && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>}
      <button type="button" onClick={submit} disabled={saving || !f.title || !f.remind_at} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40 transition">{saving ? "Saving…" : "Set reminder"}</button>
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
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"archive" | "delete" | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initialTab = VALID_TABS.includes(searchParams.get("tab") as Tab)
    ? (searchParams.get("tab") as Tab)
    : "expenses";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || isNaN(jobId)) return;
    setLoading(true);
    try {
      const { data: jobData } = await supabase.from("jobs").select("id, job_no, job_name, name, status, active, start_date, end_date, material_budget_cents, labour_hours_budget, contract_value_cents").eq("id", jobId).is("deleted_at", null).single();
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

      // Load phases via backend (includes cost breakdown JOIN)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || "";
        const phasesRes = await fetch(`/api/jobs/${jobId}/phases`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (phasesRes.ok) {
          const pj = await phasesRes.json();
          setPhases((pj.phases as PhaseRow[]) || []);
        }
      } catch {
        // phases fail-soft — tab just won't show
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [jobId, tenantId]);

  useEffect(() => {
    if (!gateLoading && tenantId) void load();
  }, [gateLoading, tenantId, load]);

  async function handleArchiveToggle() {
    if (!job) return;
    setActionErr(null);
    setActionLoading("archive");
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      const isArchived = String(job.status || "").toLowerCase() === "archived";
      const endpoint = isArchived
        ? `/api/jobs/${job.id}/unarchive`
        : `/api/jobs/${job.id}/archive`;
      const r = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.message || "Failed");
      setJob((prev) => prev ? { ...prev, status: isArchived ? "active" : "archived", active: !isArchived } : prev);
    } catch (e: any) {
      setActionErr(e.message || "Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!job) return;
    setActionErr(null);
    setActionLoading("delete");
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token || "";
      const r = await fetch(`/api/jobs/${job.id}/delete`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.message || "Failed");
      window.location.href = "/app/jobs";
    } catch (e: any) {
      setActionErr(e.message || "Something went wrong.");
      setActionLoading(null);
      setConfirmDelete(false);
    }
  }

  if (gateLoading || loading) return <div className="p-8 text-sm text-white/60">Loading…</div>;
  if (notFound || !job) return <div className="p-8 text-center"><div className="text-white/60 mb-4">Job not found.</div><Link href="/app/jobs" className="text-sm text-white/50 underline">← Back to jobs</Link></div>;

  const isArchived = String(job.status || "").toLowerCase() === "archived";
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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Job</div>
              <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-white/95">{title}</h1>
                {isArchived && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">Archived</span>
                )}
              </div>
              {(job.start_date || job.end_date) && (
                <div className="mt-1 text-sm text-white/40">
                  {job.start_date && <span>Started {new Date(job.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
                  {job.end_date && <span> · Ends {new Date(job.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>}
                </div>
              )}
            </div>

            {/* Job actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={actionLoading !== null}
                className={[
                  "rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
                  isArchived
                    ? "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    : "border-amber-500/25 bg-amber-500/8 text-amber-400/80 hover:bg-amber-500/15",
                ].join(" ")}
              >
                {actionLoading === "archive" ? "…" : isArchived ? "Unarchive" : "Archive"}
              </button>

              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">Delete this job?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={actionLoading !== null}
                    className="rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25 transition disabled:opacity-50"
                  >
                    {actionLoading === "delete" ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={actionLoading !== null}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setActionErr(null); setConfirmDelete(true); }}
                  disabled={actionLoading !== null}
                  className="rounded-xl border border-red-500/20 bg-transparent px-3 py-1.5 text-xs font-medium text-red-400/60 hover:border-red-500/30 hover:text-red-400/80 transition disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {actionErr && (
            <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {actionErr}
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

        {/* Phases — only visible when phases exist */}
        {phases.length > 0 && (
          <div className="mt-5">
            <PhasesSection
              jobId={job.id}
              phases={phases}
              onPhaseRemoved={(id) => setPhases((prev) => prev.filter((p) => p.id !== id))}
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
            <div className="space-y-4">
              <InlineLogButton job={job} type="task" label="Log Task" onDone={() => {}} />
              <DashboardDataPanel view="tasks" selectedJobName={String(job.job_name || job.name || "").trim() || null} />
            </div>
          )}
          {tab === "reminders" && (
            <div className="space-y-4">
              <InlineLogButton job={job} type="reminder" label="Log Reminder" onDone={() => {}} />
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/40">
                Reminders you set will appear here.
              </div>
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
          {tab === "photos" && tenantId && (
            <PhotosTab job={job} tenantId={tenantId} />
          )}
        </div>
      </div>
    </div>
  );
}
