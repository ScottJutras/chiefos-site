"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiFetch";

type VerificationSummary = {
  id: string;
  total_records_checked: number;
  records_valid: number;
  records_invalid: number;
  records_unhashed: number;
  verification_type: string;
  completed_at: string;
  table_name: string;
};

type RecordStatus = {
  id: string;
  record_hash: string | null;
  hash_version: number | null;
  is_valid: boolean | null;
};

function StatusBadge({ valid, count }: { valid: boolean; count?: number }) {
  const label = count !== undefined
    ? valid ? `${count} valid` : `${count} tampered`
    : valid ? "Verified" : "Tampered";
  return (
    <span className={[
      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
      valid
        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
        : "text-red-300 bg-red-500/10 border-red-500/20",
    ].join(" ")}>
      {label}
    </span>
  );
}

export default function IntegrityPage() {
  const [history, setHistory]       = useState<VerificationSummary[]>([]);
  const [running, setRunning]       = useState(false);
  const [runError, setRunError]     = useState<string | null>(null);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [lastResult, setLastResult] = useState<VerificationSummary | null>(null);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/integrity/history");
      const entries: VerificationSummary[] = data.history ?? data ?? [];
      setHistory(entries);
      if (entries.length > 0) setLastResult(entries[0]);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadHistory(); }, []);

  async function runVerification() {
    setRunError(null);
    setRunning(true);
    try {
      const result = await apiFetch("/api/integrity/verify", { method: "POST" });
      await loadHistory();
      if (result?.summary) setLastResult(result.summary);
    } catch (e: any) {
      if (e.message?.includes("PLAN_NOT_INCLUDED") || e.status === 402) {
        setRunError("On-demand verification requires a Starter or Pro plan.");
      } else {
        setRunError(e.message || "Verification failed.");
      }
    } finally {
      setRunning(false);
    }
  }

  const latestValid = lastResult
    ? lastResult.records_invalid === 0
    : null;

  return (
    <main className="space-y-6">
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <Link href="/app/settings" className="text-xs text-white/40 hover:text-white/60 transition">
          ← Settings
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
            Data Integrity
          </h1>
          {latestValid !== null && (
            <StatusBadge valid={latestValid} />
          )}
        </div>
        <div className="mt-3 text-sm text-white/60 leading-relaxed">
          Every financial record is protected by a SHA-256 hash chain. Tampering with any record
          breaks the chain — run a verification to confirm your data is untouched.
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={runVerification}
            disabled={running}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              "border border-white/10 bg-white/[0.06] text-white/90",
              "hover:bg-white/[0.09]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {running ? "Verifying…" : "Run Verification"}
          </button>

          {runError && (
            <div className="text-sm text-red-200/90 border border-red-500/20 bg-red-500/10 px-3 py-2 rounded-xl">
              {runError}
            </div>
          )}
        </div>
      </div>

      {/* Last result summary */}
      {lastResult && (
        <div className={[
          "rounded-2xl border p-5",
          lastResult.records_invalid === 0
            ? "border-emerald-500/20 bg-emerald-500/[0.05]"
            : "border-red-500/20 bg-red-500/[0.05]",
        ].join(" ")}>
          <div className="text-sm font-semibold text-white/90 mb-3">
            Last Verification —{" "}
            {new Date(lastResult.completed_at).toLocaleString("en-CA", {
              dateStyle: "medium", timeStyle: "short",
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Checked" value={lastResult.total_records_checked.toLocaleString()} />
            <Stat label="Valid" value={lastResult.records_valid.toLocaleString()} highlight="green" />
            <Stat label="Tampered" value={lastResult.records_invalid.toLocaleString()} highlight={lastResult.records_invalid > 0 ? "red" : undefined} />
            <Stat label="Unhashed" value={lastResult.records_unhashed.toLocaleString()} />
          </div>
          {lastResult.records_invalid > 0 && (
            <div className="mt-4 text-sm text-red-200/90">
              One or more records failed hash verification. This may indicate data tampering.
              Contact support if you did not make direct database changes.
            </div>
          )}
        </div>
      )}

      {/* Verification history */}
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <div className="text-sm font-semibold text-white/80 mb-4">Verification History</div>

        {loading && <div className="text-sm text-white/40">Loading history…</div>}

        {loadError && (
          <div className="text-sm text-red-200/80">
            {loadError.includes("PLAN_NOT_INCLUDED")
              ? "Verification history requires a Starter or Pro plan."
              : loadError}
          </div>
        )}

        {!loading && !loadError && history.length === 0 && (
          <div className="text-sm text-white/40">No verifications run yet.</div>
        )}

        {history.length > 0 && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wide">Checked</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wide">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                      {new Date(v.completed_at).toLocaleString("en-CA", {
                        dateStyle: "medium", timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-white/50 capitalize">{v.verification_type}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/70">{v.total_records_checked.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge valid={v.records_invalid === 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explanation */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/50 leading-relaxed space-y-2">
        <div className="font-medium text-white/70">How it works</div>
        <p>
          Each financial record stores a SHA-256 hash computed from its amount, description,
          date, job, and a pointer to the previous record hash — forming a chain.
          Any modification to an existing record breaks the chain at that point.
        </p>
        <p>
          Hashes are generated automatically on every write. On-demand verification
          re-computes all hashes and compares them against stored values.
          Use this before exporting data for tax filings, audits, or client disputes.
        </p>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className={[
        "text-2xl font-semibold tabular-nums",
        highlight === "green" ? "text-emerald-300" :
        highlight === "red"   ? "text-red-300" :
        "text-white/90",
      ].join(" ")}>
        {value}
      </div>
    </div>
  );
}
