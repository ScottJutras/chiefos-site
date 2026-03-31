"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTenantGate } from "@/lib/useTenantGate";

type Section = {
  key: string;
  label: string;
  description: string;
  detail: string;
  href?: string;
};

const SECTIONS: Section[] = [
  {
    key: "leads",
    label: "Leads",
    description: "Track potential jobs before they're committed.",
    detail:
      "Capture lead details, source, notes, and estimated value. Convert a lead to a job with one click when the client says yes.",
  },
  {
    key: "quotes",
    label: "Quotes",
    description: "Build and send itemised quotes.",
    detail:
      "Add line items with qty, unit price, and category (labour / materials / other). Apply markup %, generate a PDF, and send via SMS or email. All quote PDFs are stored here with attachments.",
  },
  {
    key: "contracts",
    label: "Contracts",
    description: "Auto-fill contracts from your quote and get them signed.",
    detail:
      "Generate a contract pre-filled from your accepted quote. Send a secure e-signature link to the client — they sign on any device and you get notified instantly. Signed PDFs attach here.",
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Invoice clients based on your quote and approved change orders.",
    detail:
      "Final invoices are auto-calculated from your quote plus all approved change orders. Generate a PDF, send it, and mark the job as paid. All invoice PDFs attach here.",
  },
  {
    key: "change-orders",
    label: "Change Orders",
    description: "Document scope changes and get client approval.",
    detail:
      "Every change order records the description, dollar amount, and approval status. Each CO generates a PDF you can send for signature. Approved COs automatically update the contract value.",
  },
  {
    key: "receipts",
    label: "Receipts",
    description: "Send payment receipts and request reviews.",
    detail:
      "Once a job is paid, generate a payment receipt PDF. Optionally attach a review request (Google / HomeStars) and a referral ask — all in one message to the client.",
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Action items tied to jobs and your crew.",
    detail: null as unknown as string,
    href: "/app/tasks",
  },
  {
    key: "reminders",
    label: "Reminders",
    description: "Follow-up reminders so nothing falls through the cracks.",
    detail:
      "Set a reminder on any job — follow up on a quote, check in after a contract is sent, or ping a client about a late invoice. Reminders surface in your Review queue on the due date.",
  },
];

function DocumentsInner() {
  const { loading } = useTenantGate({ requireWhatsApp: false });
  const searchParams = useSearchParams();
  const activeKey = searchParams.get("section") || "leads";
  const active = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0];

  if (loading) return <div className="p-8 text-sm text-white/60">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl py-2">
      {/* Page header */}
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Documents</div>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-white/95">Documents</h1>
        <p className="mt-1.5 text-sm text-white/50">
          From first contact to receipt — every document for every job, in one place.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left sub-nav */}
        <nav className="hidden w-44 shrink-0 md:block">
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <Link
                  href={`/app/documents?section=${s.key}`}
                  className={[
                    "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    s.key === activeKey
                      ? "bg-white/8 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile sub-nav: horizontal scroll chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
          {SECTIONS.map((s) => (
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
              {s.label}
            </Link>
          ))}
        </div>

        {/* Section content */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white/90">{active.label}</h2>
            <p className="mt-2 text-sm text-white/55">{active.description}</p>

            {active.href ? (
              <Link
                href={active.href}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                Go to {active.label} →
              </Link>
            ) : (
              <>
                <p className="mt-4 text-sm text-white/40 leading-relaxed">{active.detail}</p>
                <div className="mt-8 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
                  <p className="text-xs font-medium text-white/30 uppercase tracking-[0.14em]">
                    Coming soon
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    {active.label} will be available shortly. Your existing data won&apos;t be
                    affected.
                  </p>
                </div>
              </>
            )}
          </div>
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
