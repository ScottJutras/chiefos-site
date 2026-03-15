import CreateJobForm from "../../components/intake/jobs/CreateJobForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewJobPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Jobs</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Create job
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            Create a job through a deterministic portal flow. This should not route through Ask Chief.
          </p>
        </div>

        <CreateJobForm />
      </div>
    </main>
  );
}