"use client";

type SiteHeaderProps = {
  rightLabel?: string;
  rightHref?: string;
};

export default function SiteHeader({
  rightLabel = "Early Access Login",
  rightHref = "/login",
}: SiteHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <a href="/" className="text-sm font-semibold tracking-tight text-black">
              ChiefOS
            </a>

            <a
              href={rightHref}
              className="text-sm font-medium underline underline-offset-4 decoration-black/30 hover:decoration-black/60"
            >
              {rightLabel}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
