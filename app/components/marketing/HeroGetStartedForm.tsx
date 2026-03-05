"use client";

import TooltipChip from "./TooltipChip";

export default function HeroGetStartedForm({
  pricingHref = "/pricing",
  tip = "We only use your number to open WhatsApp and link your logs to your account. No spam. Never sold.",
}: {
  pricingHref?: string;
  tip?: string;
}) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const raw = (e.currentTarget as HTMLFormElement).phone?.value || "";
          const phone = String(raw).trim();

          const url = phone
            ? `${pricingHref}?phone=${encodeURIComponent(phone)}`
            : pricingHref;

          window.location.href = url;
        }}
        className="w-full max-w-xl"
      >
        <div className="relative">
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter your phone number"
            className={[
              "w-full rounded-2xl border border-white/15 bg-black/30",
              "px-4 py-3 pr-[150px]", // room for embedded button
              "text-sm text-white placeholder:text-white/40 outline-none",
              "focus:border-white/25 focus:bg-black/35",
            ].join(" ")}
          />

          <button
            type="submit"
            className={[
              "absolute right-1.5 top-1.5",
              "h-[calc(100%-12px)]",
              "rounded-xl bg-white px-4",
              "text-sm font-semibold text-black",
              "hover:bg-white/90 transition",
            ].join(" ")}
          >
            Get started
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-white/45">
          <span> We use your number for WhatsApp access + account linking. Stays private and no spamming</span>

          <TooltipChip tip={tip}>
            <span className="inline-grid h-5 w-5 place-items-center rounded-md border border-white/10 bg-black/30 text-[11px] text-white/60 cursor-default">
              i
            </span>
          </TooltipChip>
        </div>
      </form>
    </div>
  );
}