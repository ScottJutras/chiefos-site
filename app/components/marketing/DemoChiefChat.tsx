"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0C0B0A",
  bgAlt: "#0F0E0C",
  gold: "#D4A853",
  goldDim: "rgba(212,168,83,0.12)",
  goldBorder: "rgba(212,168,83,0.15)",
  goldBorderStrong: "rgba(212,168,83,0.3)",
  text: "#E8E2D8",
  textLight: "#F5F0E8",
  textMuted: "#A8A090",
  textFaint: "#706A60",
};

const SESSION_LIMIT = 10;
const SOFT_UPSELL_AT = 7; // show upsell nudge when ≤ this many questions remain

// ─── Categorised starter questions ────────────────────────────────────────────
const CATEGORIES = [
  {
    label: "Financial Intelligence",
    questions: [
      "How much did I actually make on my last job?",
      "How much do I need to make to cover payroll and bills this month?",
    ],
  },
  {
    label: "Conversational Logging",
    questions: [
      "How do I log expenses, build quotes, and more — just by texting?",
      "Do I need to download an app?",
    ],
  },
  {
    label: "Getting Started",
    questions: [
      "What's free vs. paid?",
    ],
  },
];

// Initially show 1 from each category (3 total), expand reveals the rest
const INITIAL_VISIBLE: Record<number, number> = { 0: 1, 1: 1, 2: 1 };

// ─── Pre-built scripted answers (streamed locally, no API call) ───────────────
const SCRIPTED_ANSWERS: Record<string, string> = {
  "How do I log expenses, build quotes, and more — just by texting?":
    "Everything in ChiefOS starts with a conversation. Text me a receipt photo and I'll scan it, extract the details, and attach it to the right job. Tell me 'clock in Mike on the Henderson job' and I'll start his shift. Say 'build a quote for the Thompson deck' and I'll walk you through it step by step. Voice messages work too — tell me what happened on the job and I'll log it. No forms, no menus, no data entry. Just tell me what's happening and I'll handle the rest.",
  "Do I need to download an app?":
    "No app needed to get started. ChiefOS runs on desktop (PC and Mac) through your browser, and our WhatsApp-based field logging tool lets you create jobs, send quotes, log expenses, track revenue, clock in your crew, and more — right from the app you already have on your phone. Just text, snap a photo, or send a voice message. The dedicated iOS and Android apps are coming later this spring. For now, everything you need is already in your pocket.",
};

type ChatMessage = {
  id: string;
  role: "user" | "chief";
  content: string;
  streaming?: boolean;
  error?: boolean;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function UserBubble({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
      <div style={{
        maxWidth: "80%",
        background: "rgba(212,168,83,0.09)",
        border: "1px solid rgba(212,168,83,0.22)",
        borderRadius: "12px 12px 2px 12px",
        padding: "9px 13px",
        fontSize: "13px",
        color: C.textLight,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}>
        {content}
      </div>
    </div>
  );
}

function ChiefAvatar() {
  return (
    <div style={{
      flexShrink: 0, width: "26px", height: "26px", borderRadius: "50%",
      background: "linear-gradient(135deg, #D4A853 0%, #C49840 55%, #9A7220 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "10px", fontFamily: "'Space Mono', monospace", fontWeight: 700,
      color: "#0A0900", marginTop: "1px",
      boxShadow: "0 0 10px rgba(212,168,83,0.3), 0 0 0 1px rgba(212,168,83,0.38), 0 2px 6px rgba(0,0,0,0.4)",
    }}>C</div>
  );
}

function ChiefBubble({ content, streaming, error }: { content: string; streaming?: boolean; error?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "9px", marginBottom: "14px", alignItems: "flex-start" }}>
      <ChiefAvatar />
      <div style={{
        flex: 1,
        background: error ? "rgba(180,60,60,0.06)" : "rgba(212,168,83,0.045)",
        border: `1px solid ${error ? "rgba(180,60,60,0.22)" : "rgba(212,168,83,0.16)"}`,
        borderLeft: error ? "2px solid rgba(180,60,60,0.5)" : "2px solid rgba(212,168,83,0.45)",
        borderRadius: "0 12px 12px 12px",
        padding: "10px 13px",
        fontSize: "13px",
        color: error ? "#B45A5A" : C.text,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        minHeight: "36px",
        boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
      }}>
        {content || (streaming ? "" : "…")}
        {streaming && (
          <span style={{
            display: "inline-block", width: "2px", height: "13px",
            background: C.gold, marginLeft: "2px", verticalAlign: "text-bottom",
            animation: "chief-cursor-blink 0.8s step-end infinite",
            boxShadow: "0 0 7px rgba(212,168,83,0.75)",
          }} />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "9px", marginBottom: "14px", alignItems: "flex-start" }}>
      <ChiefAvatar />
      <div style={{
        background: "rgba(212,168,83,0.045)",
        border: "1px solid rgba(212,168,83,0.16)",
        borderLeft: "2px solid rgba(212,168,83,0.45)",
        borderRadius: "0 12px 12px 12px",
        padding: "12px 16px",
        display: "flex", gap: "5px", alignItems: "center",
        boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
      }}>
        {[0, 180, 360].map((delay) => (
          <span key={delay} style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: C.gold, opacity: 0.6,
            animation: `chief-dot-bounce 1.4s ease-in-out ${delay}ms infinite`,
            boxShadow: "0 0 5px rgba(212,168,83,0.5)",
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Chip button ──────────────────────────────────────────────────────────────
function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        background: "rgba(212,168,83,0.06)",
        border: "1px solid rgba(212,168,83,0.28)",
        borderRadius: "14px",
        color: C.textMuted,
        fontSize: "11.5px",
        fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer",
        transition: "all 0.15s ease",
        lineHeight: 1.4,
        textAlign: "left" as const,
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.color = C.gold;
        b.style.borderColor = "rgba(212,168,83,0.55)";
        b.style.background = "rgba(212,168,83,0.11)";
        b.style.boxShadow = "0 0 14px rgba(212,168,83,0.12)";
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.color = C.textMuted;
        b.style.borderColor = "rgba(212,168,83,0.28)";
        b.style.background = "rgba(212,168,83,0.06)";
        b.style.boxShadow = "none";
      }}
    >
      {label}
    </button>
  );
}

// ─── Main floating widget ─────────────────────────────────────────────────────
export default function DemoChiefChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [unread, setUnread] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tokenBufferRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, awaitingFirstToken, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (open) setUnread(false);
  }, [open]);

  const handleSend = useCallback(async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || isStreaming) return;

    if (messageCount >= SESSION_LIMIT) {
      setShowUpgrade(true);
      return;
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };

    const history = messages
      .filter((m) => !m.streaming && !m.error)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setMessageCount((c) => c + 1);
    setIsStreaming(true);
    setAwaitingFirstToken(true);

    abortRef.current = new AbortController();
    const chiefMsgId = crypto.randomUUID();

    // ── Scripted fast path — no API call needed ──────────────────────────────
    const scripted = SCRIPTED_ANSWERS[trimmed];
    if (scripted) {
      try {
        // Brief thinking pause so it doesn't feel instant
        await new Promise<void>((res) => setTimeout(res, 550));
        if (abortRef.current?.signal.aborted) return;

        setMessages((prev) => [...prev, { id: chiefMsgId, role: "chief", content: "", streaming: true }]);
        setAwaitingFirstToken(false);

        // Stream 3 words at a time every 28ms for a smooth cascade
        const words = scripted.split(" ");
        let i = 0;
        while (i < words.length) {
          if (abortRef.current?.signal.aborted) break;
          const chunk = words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
          setMessages((prev) => prev.map((m) =>
            m.id === chiefMsgId ? { ...m, content: m.content + chunk } : m
          ));
          i += 3;
          await new Promise<void>((res) => setTimeout(res, 28));
        }

        setMessages((prev) => prev.map((m) =>
          m.id === chiefMsgId ? { ...m, streaming: false } : m
        ));
        if (!open) setUnread(true);
      } finally {
        setIsStreaming(false);
        setAwaitingFirstToken(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      const r = await fetch("/api/demo-chief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
        signal: abortRef.current.signal,
      });

      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("text/event-stream")) {
        const j = await r.json().catch(() => null);
        setAwaitingFirstToken(false);
        setMessages((prev) => [...prev, {
          id: chiefMsgId, role: "chief",
          content: j?.message || "Something went wrong. Please try again.",
          error: true,
        }]);
        if (!open) setUnread(true);
        return;
      }

      setMessages((prev) => [...prev, { id: chiefMsgId, role: "chief", content: "", streaming: true }]);
      setAwaitingFirstToken(false);

      tokenBufferRef.current = "";

      const flushTokens = () => {
        const chunk = tokenBufferRef.current;
        if (chunk) {
          tokenBufferRef.current = "";
          setMessages((prev) => prev.map((m) =>
            m.id === chiefMsgId ? { ...m, content: m.content + chunk } : m
          ));
        }
        rafRef.current = null;
      };

      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;

          let evt: { token?: string; error?: boolean; message?: string };
          try { evt = JSON.parse(raw); } catch { continue; }

          if (typeof evt.token === "string") {
            tokenBufferRef.current += evt.token;
            if (!rafRef.current) {
              rafRef.current = requestAnimationFrame(flushTokens);
            }
          }
          if (evt.error) {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            tokenBufferRef.current = "";
            setMessages((prev) => prev.map((m) =>
              m.id === chiefMsgId
                ? { ...m, content: evt.message || "Something went wrong.", streaming: false, error: true }
                : m
            ));
          }
        }
      }

      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (tokenBufferRef.current) {
        const remaining = tokenBufferRef.current;
        tokenBufferRef.current = "";
        setMessages((prev) => prev.map((m) =>
          m.id === chiefMsgId ? { ...m, content: m.content + remaining } : m
        ));
      }

      setMessages((prev) => prev.map((m) =>
        m.id === chiefMsgId ? { ...m, streaming: false } : m
      ));
      if (!open) setUnread(true);

    } catch (err: any) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      tokenBufferRef.current = "";
      if (err?.name === "AbortError") return;
      setAwaitingFirstToken(false);
      const hasPlaceholder = messages.some((m) => m.id === chiefMsgId);
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === chiefMsgId
            ? { ...m, content: "Something went wrong. Please try again.", streaming: false, error: true }
            : m
        );
        return hasPlaceholder
          ? updated
          : [...updated, { id: chiefMsgId, role: "chief" as const, content: "Something went wrong. Please try again.", error: true }];
      });
    } finally {
      setIsStreaming(false);
      setAwaitingFirstToken(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isStreaming, messageCount, messages, open]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const hasMessages = messages.length > 0;
  const questionsLeft = SESSION_LIMIT - messageCount;
  const showSoftUpsell = hasMessages && questionsLeft <= SOFT_UPSELL_AT && questionsLeft > 0 && !showUpgrade;

  return (
    <>
      <style>{`
        @keyframes chief-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes chief-dot-bounce { 0%,60%,100%{transform:translateY(0);opacity:.5} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes chief-widget-in {
          from{opacity:0;transform:translate(-50%,-50%) scale(0.93);filter:blur(4px)}
          to{opacity:1;transform:translate(-50%,-50%) scale(1);filter:blur(0)}
        }
        @keyframes chief-badge-pop { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes chief-ring-pulse {
          0%{transform:scale(1);opacity:0.55}
          100%{transform:scale(2.5);opacity:0}
        }
        @keyframes chief-glow-breathe {
          0%,100%{box-shadow:0 0 0 1.5px rgba(212,168,83,0.3),0 0 18px rgba(212,168,83,0.12),0 10px 40px rgba(0,0,0,0.65)}
          50%{box-shadow:0 0 0 1.5px rgba(212,168,83,0.55),0 0 38px rgba(212,168,83,0.28),0 10px 40px rgba(0,0,0,0.65)}
        }
        @keyframes chief-shimmer {
          0%{background-position:200% center}
          100%{background-position:-200% center}
        }
        @keyframes chief-scan {
          0%{transform:translateX(-120%);opacity:0}
          8%{opacity:1}
          92%{opacity:1}
          100%{transform:translateX(500px);opacity:0}
        }
        @keyframes chief-live-pulse {
          0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(74,222,128,0.5)}
          50%{opacity:0.7;box-shadow:0 0 0 4px rgba(74,222,128,0)}
        }
        @keyframes chief-label-in {
          from{opacity:0;transform:translateY(6px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes chief-upsell-in {
          from{opacity:0;transform:translateY(4px)}
          to{opacity:1;transform:translateY(0)}
        }
      `}</style>

      {/* ── Floating panel ── */}
      {open && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "420px",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 9999,
          /* Frosted glass base */
          background: "linear-gradient(160deg, #17140C 0%, #111009 30%, #0D0C0A 65%, #0A0908 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(212,168,83,0.24)",
          borderTop: "1px solid rgba(212,168,83,0.5)",
          borderRadius: "18px",
          /* Layered shadow: deep lift + gold outer glow + inner edge vignette */
          boxShadow: [
            "0 40px 100px rgba(0,0,0,0.82)",
            "0 0 0 1px rgba(212,168,83,0.06)",
            "0 0 80px rgba(212,168,83,0.08)",
            "inset 0 0 60px rgba(0,0,0,0.4)",
            "inset 0 1px 0 rgba(212,168,83,0.12)",
          ].join(", "),
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "chief-widget-in 0.32s cubic-bezier(0.16,1,0.3,1)",
          maxHeight: "580px",
        }}>

          {/* Edge vignette overlay — darkens corners for depth */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
            background: "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.45) 100%)",
            borderRadius: "18px",
          }} />

          {/* Top shimmer bar */}
          <div style={{
            position: "relative", zIndex: 1,
            height: "2px",
            background: "linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.5) 20%, #D4A853 50%, rgba(212,168,83,0.5) 80%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "chief-shimmer 3.5s linear infinite",
            flexShrink: 0,
          }} />

          {/* Streaming scan line */}
          {isStreaming && (
            <div style={{
              position: "absolute", top: "2px", left: 0, right: 0,
              height: "1px", overflow: "hidden", zIndex: 10, pointerEvents: "none",
            }}>
              <div style={{
                width: "55%", height: "100%",
                background: "linear-gradient(90deg, transparent, rgba(212,168,83,0.9), transparent)",
                animation: "chief-scan 2s ease-in-out infinite",
              }} />
            </div>
          )}

          {/* Header */}
          <div style={{
            position: "relative", zIndex: 1,
            display: "flex", alignItems: "center", gap: "11px",
            padding: "14px 16px 13px",
            borderBottom: "1px solid rgba(212,168,83,0.1)",
            background: "linear-gradient(135deg, rgba(212,168,83,0.09) 0%, rgba(212,168,83,0.02) 100%)",
            flexShrink: 0,
          }}>
            <div style={{
              flexShrink: 0, width: "34px", height: "34px", borderRadius: "50%",
              background: "linear-gradient(135deg, #D4A853 0%, #C49840 55%, #9A7220 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontFamily: "'Space Mono', monospace",
              fontWeight: 700, color: "#0A0900",
              boxShadow: "0 0 0 1px rgba(212,168,83,0.38), 0 0 20px rgba(212,168,83,0.25), 0 3px 10px rgba(0,0,0,0.5)",
            }}>C</div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "14px", fontWeight: 700, color: C.textLight,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.1px",
              }}>Ask Chief</div>
              <div style={{
                fontSize: "10px", color: C.textFaint,
                fontFamily: "'Space Mono', monospace", letterSpacing: "0.8px", marginTop: "1px",
              }}>CONTRACTOR-GRADE INTELLIGENCE</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginRight: "6px" }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#4ADE80", display: "inline-block",
                animation: "chief-live-pulse 2.2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: "10px", color: "#4ADE80", fontFamily: "'Space Mono', monospace", letterSpacing: "0.5px" }}>LIVE</span>
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(212,168,83,0.07)", border: "1px solid rgba(212,168,83,0.16)",
                cursor: "pointer", color: C.textFaint, padding: "5px",
                borderRadius: "7px", lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = "rgba(212,168,83,0.14)";
                b.style.color = C.textMuted;
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = "rgba(212,168,83,0.07)";
                b.style.color = C.textFaint;
              }}
              aria-label="Close"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{
            position: "relative", zIndex: 1,
            flex: 1, overflowY: "auto", padding: "16px 14px 0",
            scrollbarWidth: "thin", scrollbarColor: "rgba(212,168,83,0.14) transparent",
          }}>
            {!hasMessages && (
              <div style={{ marginBottom: "16px" }}>
                {/* Chief intro */}
                <div style={{
                  background: "rgba(212,168,83,0.05)",
                  border: "1px solid rgba(212,168,83,0.18)",
                  borderLeft: "2px solid rgba(212,168,83,0.5)",
                  borderRadius: "0 12px 12px 12px",
                  padding: "13px 15px",
                  marginBottom: "18px",
                  boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
                }}>
                  <p style={{ fontSize: "13px", color: C.text, margin: "0 0 10px", lineHeight: 1.65, fontWeight: 600 }}>
                    I'm Chief — welcome to ChiefOS, the operating system your business has been missing.
                  </p>
                  <p style={{ fontSize: "12px", color: C.textMuted, margin: "0 0 8px", lineHeight: 1.6 }}>
                    Here's what's included:
                  </p>
                  <ul style={{ margin: "0 0 10px", paddingLeft: "16px", listStyle: "none" }}>
                    {[
                      "Receipt Scanner & OCR",
                      "Time Clock & Crew Logging",
                      "Job Costing & Profitability",
                      "Quote, Invoice & Receipt Builder with Signature Capture",
                      "Expense & Revenue Tracking",
                      "Task Management & Reminders",
                      "Media Storage — job site photos & documents",
                      "Financial Intelligence (Ask Chief)",
                    ].map((feature) => (
                      <li key={feature} style={{
                        fontSize: "12px", color: C.textMuted, lineHeight: 1.65,
                        marginBottom: "4px", display: "flex", alignItems: "flex-start", gap: "7px",
                      }}>
                        <span style={{ color: C.gold, flexShrink: 0, marginTop: "1px", fontSize: "10px" }}>◆</span>
                        {feature}
                      </li>
                    ))}
                    <li style={{
                      fontSize: "12px", color: C.text, lineHeight: 1.65,
                      marginTop: "6px", display: "flex", alignItems: "flex-start", gap: "7px",
                    }}>
                      <span style={{ color: C.gold, flexShrink: 0, marginTop: "1px", fontSize: "10px" }}>◆</span>
                      All integrated into one OS powered by Conversation — send a text, audio message, or photo to log, track, and talk directly to your business's financial data.
                    </li>
                  </ul>
                  <p style={{ fontSize: "11px", color: C.textFaint, margin: "0 0 10px", lineHeight: 1.6, fontStyle: "italic", paddingLeft: "3px" }}>
                    ▸ More features rolling out Summer 2026
                  </p>
                  <p style={{ fontSize: "12px", color: C.gold, margin: 0, lineHeight: 1.65, fontWeight: 600 }}>
                    No setup fees. No waiting for a salesperson to book a demo. Start now — this is the operating system your business has been waiting for.
                  </p>
                </div>

                {/* Categorised chips */}
                {CATEGORIES.map((cat, catIdx) => {
                  const visibleCount = chipsExpanded ? cat.questions.length : (INITIAL_VISIBLE[catIdx] ?? 0);
                  if (visibleCount === 0) return null;
                  return (
                    <div key={cat.label} style={{ marginBottom: "12px" }}>
                      <div style={{
                        fontSize: "9.5px", color: C.textFaint,
                        fontFamily: "'Space Mono', monospace", letterSpacing: "1px",
                        marginBottom: "7px", textTransform: "uppercase",
                      }}>
                        {cat.label}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                        {cat.questions.slice(0, visibleCount).map((q) => (
                          <Chip key={q} label={q} onClick={() => handleSend(q)} />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Expand / collapse */}
                <button
                  onClick={() => setChipsExpanded((v) => !v)}
                  style={{
                    marginTop: "4px",
                    padding: "5px 12px",
                    background: "transparent",
                    border: "1px solid rgba(212,168,83,0.2)",
                    borderRadius: "12px",
                    color: C.textFaint,
                    fontSize: "11px",
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: "0.4px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.color = C.gold;
                    b.style.borderColor = "rgba(212,168,83,0.42)";
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.color = C.textFaint;
                    b.style.borderColor = "rgba(212,168,83,0.2)";
                  }}
                >
                  {chipsExpanded ? "↑ Fewer questions" : "+ More questions"}
                </button>
              </div>
            )}

            {messages.map((msg) =>
              msg.role === "user"
                ? <UserBubble key={msg.id} content={msg.content} />
                : <ChiefBubble key={msg.id} content={msg.content} streaming={msg.streaming} error={msg.error} />
            )}
            {awaitingFirstToken && <TypingIndicator />}

            {showUpgrade && (
              <div style={{ padding: "12px 0 8px", textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: C.textMuted, marginBottom: "14px", lineHeight: 1.65 }}>
                  Demo limit reached. Sign up free to ask Chief about{" "}
                  <em style={{ color: C.text }}>your real data</em>.
                </p>
                <a href="/signup" style={{
                  display: "inline-block", padding: "10px 28px",
                  background: "linear-gradient(135deg, #D4A853, #C49840)",
                  color: C.bg, borderRadius: "4px",
                  fontSize: "12px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "1.2px", textTransform: "uppercase", textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(212,168,83,0.32)",
                }}>Start Free</a>
              </div>
            )}
            <div ref={bottomRef} style={{ height: "16px" }} />
          </div>

          {/* Soft upsell strip — appears at ≤ 7 questions remaining */}
          {showSoftUpsell && (
            <div style={{
              position: "relative", zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "10px", flexWrap: "wrap",
              padding: "9px 14px",
              borderTop: "1px solid rgba(212,168,83,0.1)",
              background: "linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(212,168,83,0.02) 100%)",
              animation: "chief-upsell-in 0.3s ease",
            }}>
              <span style={{ fontSize: "11px", color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
                {questionsLeft <= 3 ? "Almost out of questions —" : "Liking Chief?"}
              </span>
              <a
                href="/signup"
                style={{
                  fontSize: "11px", fontWeight: 600, color: C.gold,
                  fontFamily: "'DM Sans', sans-serif",
                  textDecoration: "none", borderBottom: "1px solid rgba(212,168,83,0.35)",
                  paddingBottom: "1px", transition: "border-color 0.15s ease",
                }}
              >
                Sign up free →
              </a>
              <span style={{ fontSize: "11px", color: C.textFaint, fontFamily: "'DM Sans', sans-serif" }}>or</span>
              <a
                href="https://wa.me/12316802664"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "11px", fontWeight: 600, color: "#4ADE80",
                  fontFamily: "'DM Sans', sans-serif",
                  textDecoration: "none", borderBottom: "1px solid rgba(74,222,128,0.35)",
                  paddingBottom: "1px",
                }}
              >
                Add Chief on WhatsApp
              </a>
            </div>
          )}

          {/* Input */}
          {!showUpgrade && (
            <div style={{
              position: "relative", zIndex: 1,
              padding: "10px 12px 0",
              borderTop: showSoftUpsell ? "none" : "1px solid rgba(212,168,83,0.1)",
              background: "rgba(212,168,83,0.02)",
              flexShrink: 0,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: inputFocused ? "rgba(212,168,83,0.08)" : "rgba(212,168,83,0.04)",
                border: `1px solid ${inputFocused ? "rgba(212,168,83,0.35)" : "rgba(212,168,83,0.16)"}`,
                borderRadius: "9px", padding: "8px 10px",
                transition: "all 0.2s ease",
                boxShadow: inputFocused
                  ? "0 0 0 3px rgba(212,168,83,0.08), 0 0 22px rgba(212,168,83,0.08)"
                  : "none",
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={hasMessages ? "Ask a follow-up…" : "Ask Chief anything…"}
                  disabled={isStreaming}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: "13px", fontFamily: "'DM Sans', sans-serif",
                    color: C.text, caretColor: C.gold,
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isStreaming || !input.trim()}
                  style={{
                    flexShrink: 0, padding: "6px 14px",
                    background: isStreaming || !input.trim()
                      ? "transparent"
                      : "linear-gradient(135deg, #D4A853, #C49840)",
                    border: `1px solid ${isStreaming || !input.trim() ? "rgba(212,168,83,0.16)" : "transparent"}`,
                    borderRadius: "5px",
                    color: isStreaming || !input.trim() ? C.textFaint : C.bg,
                    fontSize: "12px", fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    letterSpacing: "0.3px",
                    boxShadow: isStreaming || !input.trim() ? "none" : "0 2px 14px rgba(212,168,83,0.3)",
                  }}
                >
                  {isStreaming ? "···" : "Ask"}
                </button>
              </div>

              {/* Question counter + branding footer */}
              <div style={{
                padding: "9px 0 11px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
              }}>
                {/* Counter — prominent, centered */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <div style={{
                    display: "flex", gap: "3px",
                  }}>
                    {Array.from({ length: SESSION_LIMIT }).map((_, i) => (
                      <span key={i} style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: i < messageCount
                          ? "rgba(212,168,83,0.35)"
                          : "rgba(212,168,83,0.7)",
                        transition: "background 0.3s ease",
                        boxShadow: i < messageCount ? "none" : "0 0 4px rgba(212,168,83,0.3)",
                      }} />
                    ))}
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    color: questionsLeft <= 3 ? C.gold : C.textMuted,
                    transition: "color 0.3s ease",
                  }}>
                    {questionsLeft} question{questionsLeft !== 1 ? "s" : ""} remaining
                  </span>
                </div>
                {/* Branding */}
                <div style={{
                  fontSize: "10px", color: C.textFaint,
                  fontFamily: "'Space Mono', monospace", letterSpacing: "0.5px",
                }}>
                  Powered by ChiefOS · Demo Mode
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FAB + label ── */}
      <div style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
      }}>
        {!open && (
          <div
            style={{
              background: "rgba(13,12,10,0.96)",
              border: "1px solid rgba(212,168,83,0.28)",
              borderRadius: "20px",
              padding: "8px 20px",
              animation: "chief-label-in 0.4s ease",
              boxShadow: "0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,168,83,0.05)",
              cursor: "pointer",
            }}
            onClick={() => setOpen(true)}
          >
            <span style={{
              fontSize: "13px", fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              color: C.textLight, letterSpacing: "0.1px",
              whiteSpace: "nowrap",
            }}>Ask Chief</span>
            <span style={{
              marginLeft: "8px", fontSize: "11px",
              fontFamily: "'Space Mono', monospace",
              color: C.gold,
            }}>→</span>
          </div>
        )}

        <div style={{ position: "relative", width: "60px", height: "60px" }}>
          {!open && [0, 900, 1800].map((delay) => (
            <div key={delay} style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "1px solid rgba(212,168,83,0.45)",
              animation: `chief-ring-pulse 2.7s ease-out ${delay}ms infinite`,
              pointerEvents: "none",
            }} />
          ))}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close Chief chat" : "Ask Chief"}
            style={{
              position: "relative", zIndex: 1,
              width: "60px", height: "60px", borderRadius: "50%",
              background: open
                ? "rgba(15,14,12,0.98)"
                : "radial-gradient(circle at 38% 38%, #1C1910, #0C0B0A)",
              border: `1.5px solid ${open ? "rgba(212,168,83,0.35)" : "rgba(212,168,83,0.55)"}`,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: open ? "none" : "chief-glow-breathe 3.2s ease-in-out infinite",
              transition: "transform 0.15s ease, background 0.2s ease",
              color: C.gold,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.09)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            {open ? (
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
              </svg>
            ) : (
              <span style={{
                fontFamily: "'Space Mono', monospace", fontWeight: 700,
                fontSize: "20px", color: C.gold, lineHeight: 1,
                textShadow: "0 0 14px rgba(212,168,83,0.65)",
              }}>C</span>
            )}
          </button>

          {unread && !open && (
            <span style={{
              position: "absolute", top: "2px", right: "2px",
              width: "13px", height: "13px", borderRadius: "50%",
              background: C.gold, border: `2px solid ${C.bg}`,
              animation: "chief-badge-pop 0.3s ease", zIndex: 2,
            }} />
          )}
        </div>
      </div>
    </>
  );
}
