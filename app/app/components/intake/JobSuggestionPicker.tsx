"use client";

type JobSuggestion = {
  id: number;
  job_name: string;
  status?: string | null;
};

type Props = {
  suggestions: JobSuggestion[];
  selectedJobName: string;
  onSelect: (jobName: string) => void;
};

export default function JobSuggestionPicker({
  suggestions,
  selectedJobName,
  onSelect,
}: Props) {
  if (!suggestions.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/55">
        No job suggestions yet.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="text-xs text-white/45">Suggested jobs</div>
      <div className="mt-3 grid gap-2">
        {suggestions.map((job) => {
          const active = String(selectedJobName || "").trim() === String(job.job_name || "").trim();

          return (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelect(job.job_name)}
              className={[
                "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition",
                active
                  ? "border-white/20 bg-white/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white/90">{job.job_name}</div>
                <div className="mt-1 text-xs text-white/50">Job #{job.id}</div>
              </div>

              {job.status ? (
                <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60">
                  {job.status}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}