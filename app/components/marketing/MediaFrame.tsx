// app/components/marketing/MediaFrame.tsx
"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type MediaFrameProps = {
  label?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;

  // Optional video mode
  videoSrc?: string; // e.g. "/loops/hero.mp4"
  posterSrc?: string; // e.g. "/loops/hero.jpg"
  videoClassName?: string;
  aspect?: "auto" | "16/9" | "4/3" | "1/1";
};

function aspectClass(aspect: MediaFrameProps["aspect"]) {
  switch (aspect) {
    case "16/9":
      return "aspect-video";
    case "4/3":
      return "aspect-[4/3]";
    case "1/1":
      return "aspect-square";
    default:
      return "";
  }
}

export default function MediaFrame({
  label,
  title,
  subtitle,
  children,
  videoSrc,
  posterSrc,
  videoClassName,
  aspect = "auto",
}: MediaFrameProps) {
  const [ready, setReady] = useState(false);

  return (
    <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      {(label || title || subtitle) && (
        <div className="mb-4">
          {label && <div className="text-xs text-white/50">{label}</div>}
          {title && <div className="mt-1 text-sm font-semibold text-white/90">{title}</div>}
          {subtitle && <div className="mt-1 text-xs text-white/60">{subtitle}</div>}
        </div>
      )}

      {videoSrc ? (
        <div
          className={[
            "relative overflow-hidden rounded-2xl border border-white/10 bg-black/50",
            aspectClass(aspect),
          ].join(" ")}
        >
          {/* Poster shimmer while video warms up */}
          <div
            className={[
              "absolute inset-0",
              "bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%)]",
              "transition-opacity duration-400",
              ready ? "opacity-0" : "opacity-100",
            ].join(" ")}
            aria-hidden="true"
          />

          <video
            className={[
              "w-full h-full object-cover",
              "transition-opacity duration-500",
              ready ? "opacity-100" : "opacity-0",
              videoClassName || "",
            ].join(" ").trim()}
            src={videoSrc}
            poster={posterSrc}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            onCanPlay={() => setReady(true)}
          />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
