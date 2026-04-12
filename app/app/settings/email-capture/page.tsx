"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptureInfo {
  capture_address: string;
  token: string;
  monthly_used: number;
  monthly_cap: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithBearer(path: string, method: "GET" | "POST" = "GET") {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not authenticated.");

  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify({}) : undefined,
    cache: "no-store",
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
  return payload as CaptureInfo & { ok: boolean };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UsageMeter({
  used,
  cap,
}: {
  used: number;
  cap: number | null;
}) {
  if (cap === 0) {
    return (
      <div className="text-sm text-white/55">
        Email capture is not included on the Free plan.{" "}
        <a href="/app/settings/billing" className="underline text-white/70 hover:text-white/90">
          Upgrade to Starter or Pro
        </a>{" "}
        to unlock.
      </div>
    );
  }

  const pct = cap === null ? 0 : Math.min(100, Math.round((used / cap) * 100));
  const label = cap === null ? `${used} captures this month` : `${used} / ${cap} captures this month`;

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/70">{label}</div>
      {cap !== null && (
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={[
              "h-full rounded-full transition-all",
              pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function GuideSection({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white/85 hover:bg-white/[0.03] transition"
      >
        {title}
        <span className="text-white/40 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ol className="px-5 pb-5 space-y-2 list-decimal list-inside">
          {steps.map((s, i) => (
            <li key={i} className="text-sm text-white/65 leading-relaxed">
              {s}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailCapturePage() {
  const [info, setInfo]         = useState<CaptureInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const rotateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchWithBearer("/api/settings/email-capture")
      .then((d) => setInfo(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCopy() {
    if (!info?.capture_address) return;
    await navigator.clipboard.writeText(info.capture_address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onRotate() {
    if (!confirmRotate) {
      setConfirmRotate(true);
      rotateRef.current = setTimeout(() => setConfirmRotate(false), 5000);
      return;
    }
    setConfirmRotate(false);
    if (rotateRef.current) clearTimeout(rotateRef.current);
    setRotating(true);
    setError(null);
    try {
      const d = await fetchWithBearer("/api/settings/email-capture", "POST");
      setInfo(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRotating(false);
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 animate-pulse">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="mt-3 h-7 w-48 rounded bg-white/10" />
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      {/* ── Header ── */}
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">Settings</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Email Capture
        </h1>
        <div className="mt-3 text-sm text-white/60 leading-relaxed max-w-xl">
          Forward receipts or website leads directly to Chief. Each email you
          forward is parsed and confirmed over WhatsApp — no manual data entry.
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error.toLowerCase().includes("owner") || error.toLowerCase().includes("tenant")
            ? <>Your account isn&apos;t linked to a WhatsApp number yet. <a href="/app/connect-whatsapp" className="underline text-red-100 hover:text-white">Link WhatsApp</a> to activate email capture.</>
            : error}
        </div>
      )}

      {/* ── Capture Address ── */}
      {info && (
        <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-5">
          <div className="text-sm font-semibold text-white/80 uppercase tracking-widest text-xs">
            Your Capture Address
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm text-white/90 break-all select-all">
              {info.capture_address}
            </div>
            <button
              onClick={onCopy}
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/[0.09] transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <UsageMeter
            used={info.monthly_used}
            cap={info.monthly_cap}
          />

          {/* Test CTA */}
          {info.monthly_cap !== 0 && (
            <div className="text-sm text-white/55">
              <span className="text-white/70">Test it:</span>{" "}
              <a
                href={`mailto:${info.capture_address}?subject=Receipt%20from%20Test%20Store&body=Total%3A%20%2499.95%0AVendor%3A%20Test%20Store`}
                className="underline hover:text-white/80 transition"
              >
                Send a test receipt
              </a>{" "}
              from your email client. Chief will reply over WhatsApp within 60 s.
            </div>
          )}
        </div>
      )}

      {/* ── Auto-Forwarding Guides ── */}
      {info?.monthly_cap !== 0 && (
        <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-4">
          <div className="text-sm font-semibold text-white/80 uppercase tracking-widest text-xs">
            Set Up Auto-Forwarding (Recommended)
          </div>
          <p className="text-sm text-white/55 leading-relaxed">
            Configure your email client to automatically forward receipts from
            specific senders to your capture address. Set it up once — Chief
            handles every receipt from that sender automatically.
          </p>

          <div className="space-y-2">
            <GuideSection
              title="Gmail"
              steps={[
                'Open Gmail and click the gear icon → "See all settings".',
                'Go to the "Filters and Blocked Addresses" tab.',
                'Click "Create a new filter".',
                'In the "From" field enter the vendor address (e.g. orders@homedepot.com).',
                'Click "Create filter", then check "Forward it to" and enter your capture address.',
                'Click "Create filter". Done — all future emails from that sender will arrive in Chief automatically.',
              ]}
            />
            <GuideSection
              title="Outlook / Microsoft 365"
              steps={[
                "Open Outlook on the web and click the gear icon → View all Outlook settings.",
                'Go to Mail → Rules, then click "Add new rule".',
                'Name the rule (e.g. "Chief — Home Depot receipts").',
                "Set the condition: From → enter the vendor email address.",
                'Set the action: Forward to → enter your capture address.',
                'Click Save. The rule runs on all matching incoming mail.',
              ]}
            />
            <GuideSection
              title="Apple Mail"
              steps={[
                "Open Mail on your Mac and go to Mail → Settings → Rules.",
                'Click "Add Rule".',
                'Set condition: "From" contains the vendor email address.',
                'Set action: "Forward Message" and enter your capture address.',
                "Click OK. The rule applies to all future matching messages.",
              ]}
            />
          </div>
        </div>
      )}

      {/* ── Lead Capture ── */}
      {info?.monthly_cap !== 0 && (
        <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-3">
          <div className="text-sm font-semibold text-white/80 uppercase tracking-widest text-xs">
            Website Lead Capture
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            If your website contact form sends you a notification email, forward
            that email to your capture address — or point the form's{" "}
            <span className="font-mono text-white/75">reply-to</span> directly
            at it. Chief will detect the lead, extract the contact info, and ask
            you over WhatsApp whether to create a job.
          </p>
          <p className="text-sm text-white/55 leading-relaxed">
            Works with most form builders: Gravity Forms, Typeform, Tally, WPForms,
            and any tool that sends a plain-text or HTML notification email.
          </p>
        </div>
      )}

      {/* ── Manual Forwarding ── */}
      {info?.monthly_cap !== 0 && (
        <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-3">
          <div className="text-sm font-semibold text-white/80 uppercase tracking-widest text-xs">
            Manual Forwarding
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            No setup required. Open any receipt or lead email and forward it to
            your capture address. Chief parses it and sends a WhatsApp
            confirmation — usually within 30–60 seconds.
          </p>
        </div>
      )}

      {/* ── Rotate Address ── */}
      {info && (
        <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6 space-y-3">
          <div className="text-sm font-semibold text-white/80 uppercase tracking-widest text-xs">
            Rotate Address
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Rotating generates a new capture address and immediately invalidates
            the old one. You will need to update any forwarding rules you have set up.
          </p>
          <button
            onClick={onRotate}
            disabled={rotating}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              confirmRotate
                ? "border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
                : "border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.09]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {rotating
              ? "Rotating…"
              : confirmRotate
              ? "Confirm rotate? (click again)"
              : "Rotate address"}
          </button>
        </div>
      )}
    </main>
  );
}
