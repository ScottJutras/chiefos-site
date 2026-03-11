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

function normalizeName(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function statusTone(status?: string | null) {
  const s = String(status || "").trim().toLowerCase();

  if (s === "active" || s === "open" || s === "in_progress") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }

  if (s === "paused" || s === "on_hold") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }

  if (s === "closed" || s === "completed" || s === "done") {
    return "border-white/10 bg-black/40 text-white/55";
  }

  return "border-white/10 bg-black/40 text-white/60";
}

export default function JobSuggestionPicker({
  suggestions,
  selectedJobName,
  onSelect,
}: Props) {
  const selectedNorm = normalizeName(selectedJobName);
  const hasSelected = selectedNorm.length > 0;

  if (!suggestions.length) {
    return (
      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
        <div className="text-xs uppercase tracking-[0.12em] text-white/45">Suggested jobs</div>
        <div className="mt-2 text-sm text-white/55">
          No job suggestions yet. Add the correct job manually to unlock confirmation.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.12em] text-white/45">Suggested jobs</div>
          <div className="mt-1 text-sm font-semibold text-white/90">
            {hasSelected ? "Job selected" : "Choose a job to speed up confirmation"}
          </div>
          <div className="mt-1 text-xs text-white/55">
            Selecting a job here fills the review draft immediately.
          </div>
        </div>

        {hasSelected ? (
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
            Ready for faster confirm
          </div>
        ) : (
          <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
            Job still needed
          </div>
        )}
      </div>

      {hasSelected ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-emerald-200/70">Selected job</div>
          <div className="mt-1 text-sm font-semibold text-emerald-100">{selectedJobName}</div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {suggestions.map((job) => {
          const active = selectedNorm === normalizeName(job.job_name);

          return (
            <button
              key={job.id}
              type="button"
              onClick={() => onSelect(job.job_name)}
              className={[
                "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition",
                active
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div
                  className={[
                    "truncate text-sm font-semibold",
                    active ? "text-emerald-100" : "text-white/90",
                  ].join(" ")}
                >
                  {job.job_name}
                </div>
                <div className="mt-1 text-xs text-white/50">Job #{job.id}</div>
              </div>

              <div className="flex items-center gap-2">
                {job.status ? (
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px]",
                      statusTone(job.status),
                    ].join(" ")}
                  >
                    {job.status}
                  </span>
                ) : null}

                {active ? (
                  <span className="rounded-full border border-emerald-500/20 bg-black/20 px-2.5 py-1 text-[11px] text-emerald-200">
                    Selected
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/60">
                    Use job
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}