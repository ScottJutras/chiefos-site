"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Design tokens (matches HomepageClient) ───────────────────────────────────
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

const STARTER_QUESTIONS = [
  "Show me a job P&L breakdown",
  "How does WhatsApp logging work?",
  "What's on the free plan?",
  "Can my crew log time by text?",
  "How would Chief answer 'Am I making money this month?'",
  "What happens to receipt photos I send?",
  "How is ChiefOS different from QuickBooks?",
  "Walk me through a typical work day with ChiefOS",
];

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
        background: C.goldDim,
        border: `1px solid ${C.goldBorder}`,
        borderRadius: "12px 12px 2px 12px",
        padding: "9px 13px",
        fontSize: "13px",
        color: C.textLight,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

function ChiefBubble({ content, streaming, error }: { content: string; streaming?: boolean; error?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.gold}, rgba(212,168,83,0.5))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "10px", fontFamily: "'Space Mono', monospace", fontWeight: 700,
        color: C.bg, marginTop: "1px",
      }}>
        C
      </div>
      <div style={{
        flex: 1,
        background: error ? "rgba(180,60,60,0.06)" : "rgba(212,168,83,0.05)",
        border: `1px solid ${error ? "rgba(180,60,60,0.2)" : C.goldBorder}`,
        borderRadius: "2px 12px 12px 12px",
        padding: "9px 12px",
        fontSize: "13px",
        color: error ? "#B45A5A" : C.text,
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        minHeight: "36px",
      }}>
        {content || (streaming ? "" : "…")}
        {streaming && (
          <span style={{
            display: "inline-block", width: "2px", height: "12px",
            background: C.gold, marginLeft: "2px", verticalAlign: "text-bottom",
            animation: "chief-cursor-blink 1s step-end infinite",
          }} />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "flex-start" }}>
      <div style={{
        flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.gold}, rgba(212,168,83,0.5))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "10px", fontFamily: "'Space Mono', monospace", fontWeight: 700,
        color: C.bg,
      }}>
        C
      </div>
      <div style={{
        background: "rgba(212,168,83,0.05)", border: `1px solid ${C.goldBorder}`,
        borderRadius: "2px 12px 12px 12px", padding: "12px 14px",
        display: "flex", gap: "4px", alignItems: "center",
      }}>
        {[0, 150, 300].map((delay) => (
          <span key={delay} style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: C.gold, opacity: 0.5,
            animation: `chief-dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
          }} />
        ))}
      </div>
    </div>
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, awaitingFirstToken, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Clear unread badge when opened
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
            setMessages((prev) => prev.map((m) =>
              m.id === chiefMsgId ? { ...m, content: m.content + evt.token } : m
            ));
          }
          if (evt.error) {
            setMessages((prev) => prev.map((m) =>
              m.id === chiefMsgId
                ? { ...m, content: evt.message || "Something went wrong.", streaming: false, error: true }
                : m
            ));
          }
        }
      }

      setMessages((prev) => prev.map((m) =>
        m.id === chiefMsgId ? { ...m, streaming: false } : m
      ));
      if (!open) setUnread(true);

    } catch (err: any) {
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

  return (
    <>
      <style>{`
        @keyframes chief-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes chief-dot-bounce { 0%,60%,100%{transform:translateY(0);opacity:.5} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes chief-widget-in { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes chief-badge-pop { 0%{transform:scale(0)} 70%{transform:scale(1.2)} 100%{transform:scale(1)} }
      `}</style>

      {/* ── Floating panel ── */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: "88px",
          right: "24px",
          width: "360px",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 9999,
          background: C.bgAlt,
          border: `1px solid ${C.goldBorderStrong}`,
          borderRadius: "12px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "chief-widget-in 0.25s ease",
          maxHeight: "520px",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "14px 16px",
            borderBottom: `1px solid ${C.goldBorder}`,
            background: "rgba(212,168,83,0.04)",
            flexShrink: 0,
          }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.gold}, rgba(212,168,83,0.5))`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontFamily: "'Space Mono', monospace",
              fontWeight: 700, color: C.bg, flexShrink: 0,
            }}>C</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: C.textLight, fontFamily: "'DM Sans', sans-serif" }}>
                Ask Chief
              </div>
              <div style={{ fontSize: "11px", color: C.textFaint, fontFamily: "'Space Mono', monospace", letterSpacing: "0.5px" }}>
                CHIEFOS DEMO
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: C.textFaint, padding: "4px", lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              aria-label="Close"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 0" }}>
            {!hasMessages && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "12px", color: C.textMuted, marginBottom: "12px", lineHeight: 1.6 }}>
                  Ask me anything about ChiefOS — how it works, pricing, or see a live demo answer.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {STARTER_QUESTIONS.map((q) => (
                    <button key={q} onClick={() => handleSend(q)} style={{
                      padding: "6px 12px",
                      background: "transparent",
                      border: `1px solid rgba(212,168,83,0.22)`,
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
                      b.style.borderColor = "rgba(212,168,83,0.45)";
                      b.style.background = "rgba(212,168,83,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget as HTMLButtonElement;
                      b.style.color = C.textMuted;
                      b.style.borderColor = "rgba(212,168,83,0.22)";
                      b.style.background = "transparent";
                    }}>
                      {q}
                    </button>
                  ))}
                </div>
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
                <p style={{ fontSize: "12px", color: C.textMuted, marginBottom: "12px", lineHeight: 1.6 }}>
                  Demo limit reached. Sign up free to ask Chief about{" "}
                  <em style={{ color: C.text }}>your real data</em>.
                </p>
                <a href="/signup" style={{
                  display: "inline-block", padding: "10px 28px",
                  background: C.gold, color: C.bg, borderRadius: "2px",
                  fontSize: "12px", fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "1px", textTransform: "uppercase", textDecoration: "none",
                }}>Start Free</a>
              </div>
            )}
            <div ref={bottomRef} style={{ height: "16px" }} />
          </div>

          {/* Input */}
          {!showUpgrade && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 12px",
              borderTop: `1px solid ${C.goldBorder}`,
              flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasMessages ? "Ask a follow-up…" : "Ask anything…"}
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
                  flexShrink: 0, padding: "7px 14px",
                  background: isStreaming || !input.trim() ? "transparent" : C.gold,
                  border: `1px solid ${isStreaming || !input.trim() ? "rgba(212,168,83,0.2)" : C.gold}`,
                  borderRadius: "2px",
                  color: isStreaming || !input.trim() ? C.textFaint : C.bg,
                  fontSize: "12px", fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {isStreaming ? "···" : "Ask"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAB toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Chief chat" : "Ask Chief"}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: open ? C.bgAlt : C.gold,
          border: `2px solid ${open ? C.goldBorderStrong : C.gold}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,168,83,0.15)",
          transition: "background 0.2s ease, transform 0.15s ease",
          color: open ? C.gold : C.bg,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
      >
        {open ? (
          /* X icon when open */
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
          </svg>
        ) : (
          /* Chat bubble icon when closed */
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.03 2 11c0 2.7 1.22 5.12 3.17 6.83L4 22l4.42-1.47A10.6 10.6 0 0 0 12 21c5.52 0 10-4.03 10-9S17.52 2 12 2Z" />
          </svg>
        )}

        {/* Unread badge */}
        {unread && !open && (
          <span style={{
            position: "absolute", top: "2px", right: "2px",
            width: "12px", height: "12px", borderRadius: "50%",
            background: "#D4A853", border: `2px solid ${C.bg}`,
            animation: "chief-badge-pop 0.3s ease",
          }} />
        )}
      </button>
    </>
  );
}
