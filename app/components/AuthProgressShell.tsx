"use client";

type AuthProgressStep = {
  key: string;
  label: string;
  description?: string;
};

type Props = {
  eyebrow?: string;
  title: string;
  status: string;
  steps: AuthProgressStep[];
  activeStepKey?: string | null;
  isError?: boolean;
  errorActions?: React.ReactNode;
};

function stepState(
  steps: AuthProgressStep[],
  stepKey: string,
  activeStepKey?: string | null,
  isError?: boolean
): "done" | "active" | "upcoming" | "error" {
  if (isError && activeStepKey === stepKey) return "error";

  const activeIdx = steps.findIndex((s) => s.key === activeStepKey);
  const thisIdx = steps.findIndex((s) => s.key === stepKey);

  if (activeIdx === -1 || thisIdx === -1) return "upcoming";
  if (thisIdx < activeIdx) return "done";
  if (thisIdx === activeIdx) return "active";
  return "upcoming";
}

function progressPercent(steps: AuthProgressStep[], activeStepKey?: string | null, isError?: boolean) {
  if (!steps.length) return 8;

  const activeIdx = steps.findIndex((s) => s.key === activeStepKey);
  if (activeIdx === -1) return 12;

  const base = ((activeIdx + 1) / steps.length) * 100;
  if (isError) return Math.max(18, Math.min(92, base));
  return Math.max(12, Math.min(100, base));
}

export default function AuthProgressShell({
  eyebrow = "Workspace setup",
  title,
  status,
  steps,
  activeStepKey,
  isError = false,
  errorActions,
}: Props) {
  const pct = progressPercent(steps, activeStepKey, isError);

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.11),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12 md:py-16">
        <div className="grid w-full gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:gap-10">
          {/* Left */}
          <section className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_40px_140px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              <span
                className={[
                  "h-2.5 w-2.5 rounded-full",
                  isError ? "bg-red-400" : "bg-emerald-400 animate-pulse",
                ].join(" ")}
              />
              {eyebrow}
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight leading-tight md:text-4xl">
              {title}
            </h1>

            <p
              className={[
                "mt-4 max-w-2xl text-base leading-relaxed md:text-lg",
                isError ? "text-red-200/90" : "text-white/70",
              ].join(" ")}
            >
              {status}
            </p>

            <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/50">
                  {isError ? "Setup paused" : "Secure setup in progress"}
                </div>
                <div className="text-xs text-white/40">{Math.round(pct)}%</div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-500",
                    isError ? "bg-red-400/80" : "bg-white",
                  ].join(" ")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="mt-7 grid gap-3">
              {steps.map((step) => {
                const state = stepState(steps, step.key, activeStepKey, isError);

                return (
                  <div
                    key={step.key}
                    className={[
                      "rounded-2xl border px-4 py-4 transition",
                      state === "done"
                        ? "border-white/10 bg-white/[0.06]"
                        : state === "active"
                          ? "border-white/20 bg-white/[0.09] ring-1 ring-white/10"
                          : state === "error"
                            ? "border-red-400/20 bg-red-500/10"
                            : "border-white/10 bg-black/25",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                          state === "done"
                            ? "border-white/20 bg-white text-black"
                            : state === "active"
                              ? "border-white/20 bg-white/10 text-white"
                              : state === "error"
                                ? "border-red-400/30 bg-red-500/20 text-red-100"
                                : "border-white/10 bg-white/5 text-white/45",
                        ].join(" ")}
                      >
                        {state === "done" ? "✓" : state === "error" ? "!" : ""}
                      </div>

                      <div className="min-w-0">
                        <div
                          className={[
                            "text-sm font-semibold",
                            state === "upcoming" ? "text-white/55" : "text-white/90",
                          ].join(" ")}
                        >
                          {step.label}
                        </div>

                        {step.description ? (
                          <div
                            className={[
                              "mt-1 text-xs leading-relaxed",
                              state === "upcoming" ? "text-white/40" : "text-white/55",
                            ].join(" ")}
                          >
                            {step.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {isError && errorActions ? <div className="mt-6">{errorActions}</div> : null}
          </section>

          {/* Right */}
          <aside className="rounded-[30px] border border-white/10 bg-black/40 p-6 backdrop-blur-xl md:p-8">
            <div className="text-xs uppercase tracking-[0.18em] text-white/45">
              What ChiefOS is doing
            </div>

            <div className="mt-4 space-y-4 text-sm leading-relaxed text-white/70">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                Verifying your account and resolving the correct workspace for this session.
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                Preserving tenant-safe setup before you enter the app.
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                Preparing the operating center so your first actions feel clear instead of chaotic.
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs text-white/45">Trust-first note</div>
              <div className="mt-2 text-sm leading-relaxed text-white/65">
                ChiefOS does not skip required setup steps behind the scenes. If your workspace
                needs to be created or linked safely, that happens before you enter.
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs text-white/45">Why this matters</div>
              <div className="mt-2 text-sm leading-relaxed text-white/65">
                This is the handoff from account creation into your operating system. The goal is
                not speed at any cost — it is clean setup, durable trust, and a calmer first entry.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}