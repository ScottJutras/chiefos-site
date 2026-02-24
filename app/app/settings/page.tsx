// app/app/settings/page.tsx
import Link from "next/link";

function Tile({
  title,
  sub,
  href,
  badge,
}: {
  title: string;
  sub: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition",
        "hover:bg-white/[0.06] hover:-translate-y-[1px] active:translate-y-0",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white/90">{title}</div>
          <div className="mt-2 text-sm text-white/65 leading-relaxed">{sub}</div>
        </div>
        {badge ? (
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70">
            {badge}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <main className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs tracking-[0.18em] uppercase text-white/55">Settings</div>
        <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-white/95">
          Workspace Settings
        </h1>
        <div className="mt-3 text-sm text-white/60">
          Preferences, access, billing, and operator reference.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Tile
          title="Billing"
          sub="Plan, invoices, and subscription status."
          href="/app/settings/billing"
        />

        <Tile
          title="Command Reference"
          sub="Reliable message formats you can copy and send in WhatsApp."
          href="/app/settings/commands"
          badge="Reference"
        />

        {/* Optional placeholders for future */}
        <Tile
          title="WhatsApp Connection"
          sub="Manage your WhatsApp linkage and connection health."
          href="/app/settings"
          badge="Coming soon"
        />

        <Tile
          title="Roles & Permissions"
          sub="Control who can log, approve, and view records."
          href="/app/settings"
          badge="Coming soon"
        />
      </div>
    </main>
  );
}