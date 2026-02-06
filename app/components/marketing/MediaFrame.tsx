// app/components/marketing/MediaFrame.tsx
import type { ReactNode } from "react";

type MediaFrameProps = {
  label?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;

  // Optional video mode
  videoSrc?: string;      // e.g. "/loops/hero.mp4"
  posterSrc?: string;     // e.g. "/loops/hero.jpg"
  videoClassName?: string;
};

export default function MediaFrame({
  label,
  title,
  subtitle,
  children,
  videoSrc,
  posterSrc,
  videoClassName,
}: MediaFrameProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
      {(label || title || subtitle) && (
        <div className="mb-4">
          {label && <div className="text-xs text-white/50">{label}</div>}
          {title && <div className="mt-1 text-sm font-semibold text-white/90">{title}</div>}
          {subtitle && <div className="mt-1 text-xs text-white/60">{subtitle}</div>}
        </div>
      )}

      {videoSrc ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <video
            className={["w-full h-auto", videoClassName || ""].join(" ").trim()}
            src={videoSrc}
            poster={posterSrc}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
          />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
