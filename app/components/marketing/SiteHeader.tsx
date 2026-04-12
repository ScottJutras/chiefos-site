"use client";

import Link from "next/link";

export default function SiteHeader() {
  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      padding: "20px 40px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "linear-gradient(to bottom, rgba(12,11,10,0.96), rgba(12,11,10,0))",
      backdropFilter: "blur(8px)",
    }}
    className="chiefos-nav"
    >
      <style>{`
        @media (max-width: 640px) { .chiefos-nav { padding: 16px 20px !important; } }
      `}</style>

      <Link href="/" style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: "20px",
        fontWeight: 700,
        letterSpacing: "2px",
        color: "#D4A853",
        textDecoration: "none",
      }}>
        CHIEFOS
      </Link>

      <Link href="/signup" style={{
        padding: "10px 24px",
        background: "transparent",
        border: "1px solid rgba(212,168,83,0.3)",
        color: "#D4A853",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "14px",
        fontWeight: 500,
        letterSpacing: "1px",
        cursor: "pointer",
        transition: "all 0.3s ease",
        borderRadius: "2px",
        textDecoration: "none",
        display: "inline-block",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = "rgba(212,168,83,0.08)";
        el.style.borderColor = "rgba(212,168,83,0.6)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = "transparent";
        el.style.borderColor = "rgba(212,168,83,0.3)";
      }}
      >
        Get Started
      </Link>
    </nav>
  );
}
