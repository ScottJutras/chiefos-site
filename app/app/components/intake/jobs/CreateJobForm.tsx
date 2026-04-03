"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CreateJobOk = {
  ok: true;
  job?: {
    id?: string | number | null;
    job_no?: number | null;
    name?: string | null;
    job_name?: string | null;
  } | null;
  message?: string;
};

type CreateJobErr = {
  ok: false;
  code?: string;
  message?: string;
  traceId?: string;
};

type CreateJobResp = CreateJobOk | CreateJobErr;

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function canonicalAppPath(path: string) {
  const safePath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") return safePath;

  const host = window.location.host.toLowerCase();
  const isMarketingHost = host === "www.usechiefos.com" || host === "usechiefos.com";

  if (isMarketingHost) {
    return `https://app.usechiefos.com${safePath}`;
  }

  return safePath;
}

export default function CreateJobForm() {
  const router = useRouter();

  const [jobName, setJobName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resp, setResp] = useState<CreateJobResp | null>(null);

  const trimmedName = useMemo(() => jobName.trim(), [jobName]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!trimmedName || submitting) return;

    setSubmitting(true);
    setResp(null);

    try {
      const sess = await supabase.auth.getSession();
      const token = sess?.data?.session?.access_token || "";

      if (!token) {
        setResp({
          ok: false,
          code: "AUTH_REQUIRED",
          message: "Please log in again before creating a job.",
        });
        return;
      }

      const r = await fetch("/api/jobs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      let j: any = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      if (r.ok && j?.ok === true) {
        setResp({
          ok: true,
          job: j?.job || null,
          message: j?.message || "Job created.",
        });

        const jobId = j?.job?.id != null ? String(j.job.id).trim() : "";
        const target = jobId
          ? canonicalAppPath(`/app/jobs/${encodeURIComponent(jobId)}`)
          : canonicalAppPath("/app/jobs");

        window.setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 600);

        return;
      }

      setResp({
        ok: false,
        code: j?.code || `HTTP_${r.status}`,
        message: j?.message || "Could not create the job.",
        traceId: j?.traceId,
      });
    } catch (e: any) {
      setResp({
        ok: false,
        code: "NETWORK_ERROR",
        message: e?.message || "Could not create the job.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="job-name" className="block text-sm font-medium text-white/85">
            Job name
          </label>
          <p className="mt-1 text-xs leading-5 text-white/50">
            Use the customer or site name plus the job type. Example: “Oak Street re-roof”.
          </p>

          <input
            id="job-name"
            name="jobName"
            type="text"
            autoComplete="off"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="Oak Street re-roof"
            disabled={submitting}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-xs uppercase tracking-[0.12em] text-white/40">What happens next</div>
          <ul className="mt-3 space-y-2 text-sm text-white/65">
            <li>• Create the job through a portal-safe route</li>
            <li>• Keep this flow deterministic and out of Ask Chief</li>
            <li>• Return you to the dashboard workspace after success</li>
          </ul>
        </div>

        {resp?.ok === true ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="text-sm font-semibold text-emerald-200">Job created</div>
            <div className="mt-1 text-sm text-emerald-100/85">
              {resp.message || "Job created successfully."}
            </div>

            {resp.job ? (
              <div className="mt-2 text-xs text-emerald-100/75">
                {resp.job.job_no != null ? `Job #${resp.job.job_no}` : "Job created"}
                {" · "}
                {resp.job.job_name || resp.job.name || "Untitled job"}
              </div>
            ) : null}
          </div>
        ) : null}

        {resp?.ok === false ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="text-sm font-semibold text-red-200">Couldn’t create job</div>
            <div className="mt-1 text-sm text-red-100/85">
              {resp.message || "Please try again."}
            </div>
            {resp.traceId ? (
              <div className="mt-2 text-[11px] text-red-100/60">Trace: {resp.traceId}</div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={submitting || !trimmedName}
            className={cls(
              "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition",
              submitting || !trimmedName
                ? "cursor-not-allowed bg-white/20 text-white/45"
                : "bg-white text-black hover:bg-white/90"
            )}
          >
            {submitting ? "Creating…" : "Create job"}
          </button>

          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}