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

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
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
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
      <div
        style={{
          maxWidth: "75%",
          background: C.goldDim,
          border: `1px solid ${C.goldBorder}`,
          borderRadius: "12px 12px 2px 12px",
          padding: "10px 14px",
          fontSize: "14px",
          color: C.textLight,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function ChiefBubble({ content, streaming, error }: { content: string; streaming?: boolean; error?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "flex-start" }}>
      {/* Chief avatar */}
      <div
        style={{
          flexShrink: 0,
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.gold}, rgba(212,168,83,0.5))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontFamily: "'Space Mono', monospace",
          fontWeight: 700,
          color: C.bg,
          marginTop: "2px",
        }}
      >
        C
      </div>
      <div
        style={{
          flex: 1,
          background: error ? "rgba(180,60,60,0.06)" : "rgba(212,168,83,0.05)",
          border: `1px solid ${error ? "rgba(180,60,60,0.2)" : C.goldBorder}`,
          borderRadius: "2px 12px 12px 12px",
          padding: "12px 14px",
          fontSize: "14px",
          color: error ? "#B45A5A" : C.text,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          minHeight: "40px",
        }}
      >
        {content || (streaming ? "" : "…")}
        {streaming && (
          <span
            style={{
              display: "inline-block",
              width: "2px",
              height: "14px",
              background: C.gold,
              marginLeft: "2px",
              verticalAlign: "text-bottom",
              animation: "chief-cursor-blink 1s step-end infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "flex-start" }}>
      <div
        style={{
          flexShrink: 0,
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.gold}, rgba(212,168,83,0.5))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontFamily: "'Space Mono', monospace",
          fontWeight: 700,
          color: C.bg,
          marginTop: "2px",
        }}
      >
        C
      </div>
      <div
        style={{
          background: "rgba(212,168,83,0.05)",
          border: `1px solid ${C.goldBorder}`,
          borderRadius: "2px 12px 12px 12px",
          padding: "14px 18px",
          display: "flex",
          gap: "5px",
          alignItems: "center",
        }}
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: C.gold,
              opacity: 0.5,
              animation: `chief-dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DemoChiefChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, awaitingFirstToken]);

  const handleSend = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || isStreaming) return;

      if (messageCount >= SESSION_LIMIT) {
        setShowUpgrade(true);
        return;
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };

      // Build history from current messages before appending the new one
      const history = messages
        .filter((m) => !m.streaming && !m.error)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));

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
          setMessages((prev) => [
            ...prev,
            {
              id: chiefMsgId,
              role: "chief",
              content: j?.message || "Something went wrong. Please try again.",
              error: true,
            },
          ]);
          return;
        }

        // Add streaming placeholder
        setMessages((prev) => [
          ...prev,
          { id: chiefMsgId, role: "chief", content: "", streaming: true },
        ]);
        setAwaitingFirstToken(false);

        // Read SSE stream
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
            try {
              evt = JSON.parse(raw);
            } catch {
              continue;
            }

            if (typeof evt.token === "string") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === chiefMsgId
                    ? { ...m, content: m.content + evt.token }
                    : m
                )
              );
            }

            if (evt.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === chiefMsgId
                    ? { ...m, content: evt.message || "Something went wrong.", streaming: false, error: true }
                    : m
                )
              );
            }
          }
        }

        // Mark streaming complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === chiefMsgId ? { ...m, streaming: false } : m
          )
        );
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setAwaitingFirstToken(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === chiefMsgId
              ? { ...m, content: "Something went wrong. Please try again.", streaming: false, error: true }
              : m.id === userMsg.id
              ? m
              : m
          ).concat(
            prev.find((m) => m.id === chiefMsgId)
              ? []
              : [{ id: chiefMsgId, role: "chief", content: "Something went wrong. Please try again.", error: true }]
          )
        );
      } finally {
        setIsStreaming(false);
        setAwaitingFirstToken(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [input, isStreaming, messageCount, messages]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes chief-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes chief-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Starter chips — only shown before any messages */}
        {!hasMessages && (
          <div
            className="chief-demo-chips"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "32px",
              justifyContent: "center",
            }}
          >
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                style={{
                  padding: "9px 16px",
                  background: "transparent",
                  border: `1px solid rgba(212,168,83,0.25)`,
                  borderRadius: "20px",
                  color: C.textMuted,
                  fontSize: "13px",
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  lineHeight: 1.4,
                  textAlign: "left" as const,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = C.gold;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,168,83,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,168,83,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = C.textMuted;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,168,83,0.25)";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Chat container */}
        <div
          style={{
            background: C.bgAlt,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Message history */}
          {hasMessages && (
            <div
              style={{
                padding: "20px 20px 0",
                maxHeight: "460px",
                overflowY: "auto",
              }}
            >
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <UserBubble key={msg.id} content={msg.content} />
                ) : (
                  <ChiefBubble
                    key={msg.id}
                    content={msg.content}
                    streaming={msg.streaming}
                    error={msg.error}
                  />
                )
              )}
              {awaitingFirstToken && <TypingIndicator />}
              <div ref={bottomRef} style={{ height: "20px" }} />
            </div>
          )}

          {/* Upgrade CTA when session limit hit */}
          {showUpgrade ? (
            <div
              style={{
                padding: "24px 20px",
                borderTop: hasMessages ? `1px solid ${C.goldBorder}` : "none",
                textAlign: "center",
              }}
            >
              <p style={{ color: C.textMuted, fontSize: "14px", marginBottom: "16px", lineHeight: 1.6 }}>
                You&apos;ve hit the demo limit. Sign up free to ask Chief about{" "}
                <em style={{ color: C.text }}>your actual business data</em> — unlimited questions.
              </p>
              <a
                href="/signup"
                style={{
                  display: "inline-block",
                  padding: "13px 36px",
                  background: C.gold,
                  color: C.bg,
                  borderRadius: "2px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "#C49843")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = C.gold)}
              >
                Start Free — No Credit Card
              </a>
            </div>
          ) : (
            /* Input row */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "14px 16px",
                borderTop: hasMessages ? `1px solid ${C.goldBorder}` : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "11px",
                  color: C.gold,
                  flexShrink: 0,
                  letterSpacing: "1px",
                  opacity: 0.8,
                }}
              >
                CHIEF
              </div>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasMessages ? "Ask a follow-up…" : "Ask anything about ChiefOS…"}
                disabled={isStreaming}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: "14px",
                  fontFamily: "'DM Sans', sans-serif",
                  color: C.text,
                  caretColor: C.gold,
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isStreaming || !input.trim()}
                style={{
                  flexShrink: 0,
                  padding: "8px 18px",
                  background: isStreaming || !input.trim() ? "transparent" : C.gold,
                  border: `1px solid ${isStreaming || !input.trim() ? "rgba(212,168,83,0.2)" : C.gold}`,
                  borderRadius: "2px",
                  color: isStreaming || !input.trim() ? C.textFaint : C.bg,
                  fontSize: "13px",
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: isStreaming || !input.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.5px",
                }}
              >
                {isStreaming ? "···" : "Ask"}
              </button>
            </div>
          )}
        </div>

        {/* Subtle hint below chat */}
        {!hasMessages && (
          <p
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: C.textFaint,
              marginTop: "16px",
              fontFamily: "'Space Mono', monospace",
              letterSpacing: "1px",
            }}
          >
            DEMO · No account needed · Powered by real ChiefOS knowledge
          </p>
        )}
      </div>
    </>
  );
}
