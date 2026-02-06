// app/components/marketing/SiteFooter.tsx

type SiteFooterProps = {
  brandLine?: string;
  subLine?: string;
};

export default function SiteFooter({
  brandLine = "ChiefOS puts reality into the equation.",
  subLine = "Capture real work. Understand real jobs.",
}: SiteFooterProps) {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-6">
            <div className="text-lg font-semibold text-white">{brandLine}</div>
            <div className="mt-2 text-sm text-white/60">{subLine}</div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/early-access"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                Get early access
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Sign in
              </a>
            </div>

            <div className="mt-6 text-xs text-white/40">
              © {new Date().getFullYear()} ChiefOS. Privacy-first by design.
            </div>
          </div>

          <div className="md:col-span-6">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white/70">Product</div>
                <div className="space-y-2 text-sm text-white/60">
                  <a className="block hover:text-white transition" href="/#product">
                    Overview
                  </a>
                  <a className="block hover:text-white transition" href="/#how">
                    How it works
                  </a>
                  <a className="block hover:text-white transition" href="/#why">
                    Why ChiefOS
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-white/70">Access</div>
                <div className="space-y-2 text-sm text-white/60">
                  <a className="block hover:text-white transition" href="/early-access">
                    Early access
                  </a>
                  <a className="block hover:text-white transition" href="/login">
                    Sign in
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-white/70">Contact</div>
                <div className="space-y-2 text-sm text-white/60">
                  <a className="block hover:text-white transition" href="mailto:hello@usechiefos.com">
                    hello@usechiefos.com
                  </a>
                  <a className="block hover:text-white transition" href="mailto:scott@scottjutras.com">
                    scott@scottjutras.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
