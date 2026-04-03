"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type GalleryPhoto = {
  id: string;
  description: string | null;
  public_url: string;
  created_at: string;
};

export default function GalleryPage() {
  const params = useParams();
  const token = String(params.token || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`/api/gallery/${token}`);
        const j = await r.json();
        if (!j.ok) { setError(j.message || "Gallery not found."); setLoading(false); return; }
        setJobName(j.job?.name || "Job Photos");
        setPhotos(j.photos || []);
        setExpiresAt(j.expiresAt || null);
      } catch {
        setError("Could not load gallery.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/50 text-sm">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-white/60 text-sm mb-2">{error}</div>
          <div className="text-white/30 text-xs">This link may have expired or been removed.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.public_url}
              alt={selected.description || "Job photo"}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            {selected.description && (
              <div className="mt-3 text-sm text-white/70 text-center">{selected.description}</div>
            )}
            <div className="mt-3 flex justify-center gap-3">
              <a
                href={selected.public_url}
                download
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
                onClick={(e) => e.stopPropagation()}
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/35 mb-1">ChiefOS</div>
          <h1 className="text-2xl font-semibold text-white/95">{jobName}</h1>
          <div className="mt-1 text-sm text-white/45">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
            {expiresAt && (
              <span className="ml-2 text-white/30">· Link valid until {fmtDate(expiresAt)}</span>
            )}
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-white/40">
            No photos in this gallery yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/25 transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.public_url}
                  alt={p.description || "Job photo"}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {p.description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1.5 text-[11px] text-white/80 text-left line-clamp-1">
                    {p.description}
                  </div>
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/70">
                  {fmtDate(p.created_at)}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Download all */}
        {photos.length > 0 && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="text-xs text-white/30">Click any photo to view full size and download</div>
          </div>
        )}

        <div className="mt-12 border-t border-white/8 pt-6 text-center">
          <div className="text-[11px] text-white/20">Powered by ChiefOS</div>
        </div>
      </div>
    </div>
  );
}
