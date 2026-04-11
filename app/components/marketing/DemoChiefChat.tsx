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
        background: "rgba(212,168,83,0.09)",
        border: "1px solid rgba(212,168,83,0.2)",
        borderRadius: "12px 12px 2px 12px",
        padding: "9px 13px",
        fontSize: "13px",
        color: C.textLight,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
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
      boxShadow: "0 0 10px rgba(212,168,83,0.28), 0 0 0 1px rgba(212,168,83,0.35), 0 2px 6px rgba(0,0,0,0.4)",
    }}>
      C
    </div>
  );
}

function ChiefBubble({ content, streaming, error }: { content: string; streaming?: boolean; error?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "9px", marginBottom: "14px", alignItems: "flex-start" }}>
      <ChiefAvatar />
      <div style={{
        flex: 1,
        background: error ? "rgba(180,60,60,0.06)" : "rgba(212,168,83,0.04)",
        border: `1px solid ${error ? "rgba(180,60,60,0.2)" : "rgba(212,168,83,0.13)"}`,
        borderLeft: error ? "2px solid rgba(180,60,60,0.45)" : "2px solid rgba(212,168,83,0.4)",
        borderRadius: "0 12px 12px 12px",
        padding: "10px 13px",
        fontSize: "13px",
        color: error ? "#B45A5A" : C.text,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        minHeight: "36px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      }}>
        {content || (streaming ? "" : "…")}
        {streaming && (
          <span style={{
            display: "inline-block", width: "2px", height: "13px",
            background: C.gold, marginLeft: "2px", verticalAlign: "text-bottom",
            animation: "chief-cursor-blink 0.8s step-end infinite",
            boxShadow: "0 0 6px rgba(212,168,83,0.7)",
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
        background: "rgba(212,168,83,0.04)",
        border: "1px solid rgba(212,168,83,0.13)",
        borderLeft: "2px solid rgba(212,168,83,0.4)",
        borderRadius: "0 12px 12px 12px",
        padding: "12px 16px",
        display: "flex", gap: "5px", alignItems: "center",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
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

      // Flush any remaining buffered tokens before marking done
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

  return (
    <>
      <style>{`
        @keyframes chief-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes chief-dot-bounce { 0%,60%,100%{transform:translateY(0);opacity:.5} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes chief-widget-in {
          from{opacity:0;transform:translateY(22px) scale(0.94);filter:blur(3px)}
          to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
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
          from{opacity:0;transform:translateX(10px)}
          to{opacity:1;transform:translateX(0)}
        }
      `}</style>

      {/* ── Floating panel ── */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: "96px",
          right: "24px",
          width: "384px",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 9999,
          background: "linear-gradient(160deg, #141209 0%, #0F0E0C 45%, #0C0B0A 100%)",
          border: "1px solid rgba(212,168,83,0.22)",
          borderTop: "1px solid rgba(212,168,83,0.45)",
          borderRadius: "16px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(212,168,83,0.05), 0 0 60px rgba(212,168,83,0.07)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "chief-widget-in 0.32s cubic-bezier(0.16,1,0.3,1)",
          maxHeight: "560px",
        }}>

          {/* Top shimmer bar */}
          <div style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.6) 25%, #D4A853 50%, rgba(212,168,83,0.6) 75%, transparent 100%)",
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
            display: "flex", alignItems: "center", gap: "11px",
            padding: "14px 16px 13px",
            borderBottom: "1px solid rgba(212,168,83,0.09)",
            background: "linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(212,168,83,0.02) 100%)",
            flexShrink: 0,
          }}>
            {/* Avatar */}
            <div style={{
              flexShrink: 0, width: "34px", height: "34px", borderRadius: "50%",
              background: "linear-gradient(135deg, #D4A853 0%, #C49840 55%, #9A7220 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontFamily: "'Space Mono', monospace",
              fontWeight: 700, color: "#09080600",
              boxShadow: "0 0 0 1px rgba(212,168,83,0.35), 0 0 18px rgba(212,168,83,0.22), 0 3px 10px rgba(0,0,0,0.45)",
            }}>
              <span style={{ color: "#0A0900" }}>C</span>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "14px", fontWeight: 700, color: C.textLight,
                fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.1px",
              }}>
                Ask Chief
              </div>
              <div style={{
                fontSize: "10px", color: C.textFaint,
                fontFamily: "'Space Mono', monospace", letterSpacing: "0.8px", marginTop: "1px",
              }}>
                CHIEFOS INTELLIGENCE
              </div>
            </div>

            {/* Live indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginRight: "6px" }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#4ADE80",
                display: "inline-block",
                animation: "chief-live-pulse 2.2s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: "10px", color: "#4ADE80",
                fontFamily: "'Space Mono', monospace", letterSpacing: "0.5px",
              }}>LIVE</span>
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(212,168,83,0.07)", border: "1px solid rgba(212,168,83,0.15)",
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
            flex: 1, overflowY: "auto", padding: "16px 14px 0",
            scrollbarWidth: "thin", scrollbarColor: "rgba(212,168,83,0.12) transparent",
          }}>
            {!hasMessages && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  background: "rgba(212,168,83,0.04)",
                  border: "1px solid rgba(212,168,83,0.12)",
                  borderLeft: "2px solid rgba(212,168,83,0.4)",
                  borderRadius: "0 10px 10px 10px",
                  padding: "11px 14px",
                  marginBottom: "14px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                }}>
                  <p style={{ fontSize: "12.5px", color: C.textMuted, margin: 0, lineHeight: 1.65 }}>
                    I have full visibility into your jobs, expenses, crew hours, and cash flow — ask me anything.
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      style={{
                        padding: "6px 12px",
                        background: "rgba(212,168,83,0.04)",
                        border: "1px solid rgba(212,168,83,0.18)",
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
                        b.style.background = "rgba(212,168,83,0.08)";
                        b.style.boxShadow = "0 0 12px rgba(212,168,83,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.color = C.textMuted;
                        b.style.borderColor = "rgba(212,168,83,0.18)";
                        b.style.background = "rgba(212,168,83,0.04)";
                        b.style.boxShadow = "none";
                      }}
                    >
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
                  boxShadow: "0 4px 20px rgba(212,168,83,0.3)",
                }}>Start Free</a>
              </div>
            )}
            <div ref={bottomRef} style={{ height: "16px" }} />
          </div>

          {/* Input */}
          {!showUpgrade && (
            <div style={{
              padding: "10px 12px 12px",
              borderTop: "1px solid rgba(212,168,83,0.09)",
              background: "rgba(212,168,83,0.02)",
              flexShrink: 0,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: inputFocused ? "rgba(212,168,83,0.07)" : "rgba(212,168,83,0.03)",
                border: `1px solid ${inputFocused ? "rgba(212,168,83,0.32)" : "rgba(212,168,83,0.13)"}`,
                borderRadius: "9px", padding: "8px 10px",
                transition: "all 0.2s ease",
                boxShadow: inputFocused
                  ? "0 0 0 3px rgba(212,168,83,0.07), 0 0 20px rgba(212,168,83,0.07)"
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
                    border: `1px solid ${isStreaming || !input.trim() ? "rgba(212,168,83,0.15)" : "transparent"}`,
                    borderRadius: "5px",
                    color: isStreaming || !input.trim() ? C.textFaint : C.bg,
                    fontSize: "12px", fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    letterSpacing: "0.3px",
                    boxShadow: isStreaming || !input.trim() ? "none" : "0 2px 12px rgba(212,168,83,0.28)",
                  }}
                >
                  {isStreaming ? "···" : "Ask"}
                </button>
              </div>
              {!hasMessages && (
                <div style={{
                  marginTop: "8px", fontSize: "10px", color: C.textFaint,
                  fontFamily: "'Space Mono', monospace", letterSpacing: "0.4px",
                  textAlign: "center",
                }}>
                  AI-POWERED · DEMO MODE · {questionsLeft} QUESTIONS REMAINING
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FAB + label ── */}
      <div style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}>
        {/* "Ask Chief" label pill — visible when closed */}
        {!open && (
          <div
            style={{
              background: "rgba(13,12,10,0.96)",
              border: "1px solid rgba(212,168,83,0.28)",
              borderRadius: "20px",
              padding: "8px 16px",
              animation: "chief-label-in 0.4s ease",
              boxShadow: "0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,168,83,0.05)",
              cursor: "pointer",
            }}
            onClick={() => setOpen(true)}
          >
            <span style={{
              fontSize: "12px", fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              color: C.textLight, letterSpacing: "0.1px",
              whiteSpace: "nowrap",
            }}>
              Ask Chief
            </span>
            <span style={{
              marginLeft: "7px", fontSize: "11px",
              fontFamily: "'Space Mono', monospace",
              color: C.gold,
            }}>→</span>
          </div>
        )}

        {/* FAB button with pulsing rings */}
        <div style={{ position: "relative", width: "60px", height: "60px" }}>
          {/* Pulsing rings — only when panel is closed */}
          {!open && [0, 900, 1800].map((delay) => (
            <div
              key={delay}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1px solid rgba(212,168,83,0.45)",
                animation: `chief-ring-pulse 2.7s ease-out ${delay}ms infinite`,
                pointerEvents: "none",
              }}
            />
          ))}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close Chief chat" : "Ask Chief"}
            style={{
              position: "relative", zIndex: 1,
              width: "60px", height: "60px",
              borderRadius: "50%",
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
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                fontSize: "20px",
                color: C.gold,
                lineHeight: 1,
                textShadow: "0 0 14px rgba(212,168,83,0.65)",
              }}>C</span>
            )}
          </button>

          {/* Unread badge */}
          {unread && !open && (
            <span style={{
              position: "absolute", top: "2px", right: "2px",
              width: "13px", height: "13px", borderRadius: "50%",
              background: C.gold, border: `2px solid ${C.bg}`,
              animation: "chief-badge-pop 0.3s ease",
              zIndex: 2,
            }} />
          )}
        </div>
      </div>
    </>
  );
}
