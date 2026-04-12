import CreateJobForm from "../../components/intake/jobs/CreateJobForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewJobPage() {
  return (
    <main className="space-y-6">
      <div className="rounded-[28px] border border-[var(--gold-border)] bg-white/[0.04] p-6">
        <Link href="/app/jobs" className="text-xs text-white/40 hover:text-white/60 transition">
          ← Jobs
        </Link>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Create Job
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed max-w-2xl">
          Add a new job to track expenses, revenue, and labour costs separately from your company totals.
        </p>
      </div>

      <CreateJobForm />
    </main>
  );
}