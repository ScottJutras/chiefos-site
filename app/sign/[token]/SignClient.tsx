"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type Props = {
  token: string;
  fileId: string;
  kind: string;
  label: string | null;
  pdfUrl: string | null;
  jobName: string;
};

export default function SignClient({ token, kind, label, pdfUrl, jobName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const kindLabel =
    { quote: "Quote", contract: "Contract", change_order: "Change Order" }[kind] || kind;

  // Resize canvas to match display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPos(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  const startDraw = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setDrawing(true);
    lastPos.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "#D4A853";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const draw = useCallback((x: number, y: number) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPos.current = { x, y };
    setHasSig(true);
  }, [drawing]);

  const stopDraw = useCallback(() => {
    setDrawing(false);
    lastPos.current = null;
  }, []);

  // Mouse events
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = getPos(e.clientX, e.clientY, e.currentTarget);
    startDraw(p.x, p.y);
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const p = getPos(e.clientX, e.clientY, e.currentTarget);
    draw(p.x, p.y);
  }

  // Touch events
  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const t = e.touches[0];
    const p = getPos(t.clientX, t.clientY, e.currentTarget);
    startDraw(p.x, p.y);
  }
  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!drawing) return;
    const t = e.touches[0];
    const p = getPos(t.clientX, t.clientY, e.currentTarget);
    draw(p.x, p.y);
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
    setHasSig(false);
  }

  async function submit() {
    const canvas = canvasRef.current;
    if (!canvas || !hasSig) return;
    setSubmitting(true);
    setError(null);

    const dataUrl = canvas.toDataURL("image/png");

    const res = await fetch("/api/documents/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, signatureDataUrl: dataUrl }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error || "Signing failed. Please try again.");
      setSubmitting(false);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0C0B0A] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4 text-[#D4A853]">✓</div>
          <h1 className="text-2xl font-semibold text-[#E8E2D8] mb-2">Signed successfully</h1>
          <p className="text-[#A8A090] text-sm">
            Your signature has been saved. Your contractor has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0B0A]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-[#706A60] mb-1">ChiefOS</div>
          <h1 className="text-2xl font-semibold text-[#E8E2D8]">
            {label || kindLabel}: {jobName}
          </h1>
          <p className="text-sm text-[#A8A090] mt-1">
            Please review the document below, then sign in the box provided.
          </p>
        </div>

        {/* PDF Preview */}
        {pdfUrl ? (
          <div className="mb-8 rounded-2xl overflow-hidden border border-[rgba(212,168,83,0.15)]">
            <iframe
              src={pdfUrl}
              className="w-full"
              style={{ height: "480px" }}
              title={kindLabel}
            />
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] p-8 text-center text-sm text-[#706A60]">
            Document preview not available.
          </div>
        )}

        {/* Signature pad */}
        <div className="bg-[#0F0E0C] rounded-2xl border border-[rgba(212,168,83,0.15)] p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-[#A8A090]">Your signature</label>
            {hasSig && (
              <button
                type="button"
                onClick={clearSig}
                className="text-xs text-[#706A60] hover:text-[#D4A853] transition"
              >
                Clear
              </button>
            )}
          </div>

          <div className="relative rounded-xl border-2 border-dashed border-[rgba(212,168,83,0.2)] overflow-hidden bg-[#0C0B0A]"
            style={{ touchAction: "none" }}>
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              style={{ height: "160px", display: "block" }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={stopDraw}
            />
            {!hasSig && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#706A60]">
                Draw your signature here
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-[#706A60]">
            By signing, you agree to the scope of work and terms in this {kindLabel.toLowerCase()}.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!hasSig || submitting}
          className="w-full rounded-[2px] bg-[#D4A853] text-[#0C0B0A] py-3 text-sm font-semibold hover:bg-[#C49843] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving signature…" : `Sign ${kindLabel}`}
        </button>
      </div>
    </div>
  );
}
