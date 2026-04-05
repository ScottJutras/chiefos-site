"use client";

import { useState, useEffect, useRef } from "react";
import SiteFooter from "@/app/components/marketing/SiteFooter";

// ─── Scroll-reveal ───────────────────────────────────────────────────────────

const useInView = (options = {}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, ...options }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, isInView] as const;
};

const FadeIn = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const [ref, isInView] = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.75s ease ${delay}s, transform 0.75s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

// ─── Tokens ──────────────────────────────────────────────────────────────────

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
  redDim: "rgba(180,60,60,0.06)",
  redBorder: "rgba(180,60,60,0.15)",
  red: "#B45A5A",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    fontFamily: "'DM Sans', sans-serif",
    background: C.bg,
    color: C.text,
    minHeight: "100vh",
    overflowX: "hidden" as const,
    lineHeight: 1.65,
  },
  nav: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: "20px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: `linear-gradient(to bottom, rgba(12,11,10,0.96), rgba(12,11,10,0))`,
    backdropFilter: "blur(8px)",
  },
  logo: {
    fontFamily: "'Space Mono', monospace",
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "2px",
    color: C.gold,
  },
  navCta: {
    padding: "10px 24px",
    background: "transparent",
    border: `1px solid ${C.goldBorderStrong}`,
    color: C.gold,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: "1px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    borderRadius: "2px",
  },
  hero: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center" as const,
    padding: "120px 24px 80px",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  heroGlow: {
    position: "absolute" as const,
    top: "-200px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "800px",
    height: "800px",
    background: `radial-gradient(ellipse, rgba(212,168,83,0.07) 0%, transparent 70%)`,
    pointerEvents: "none" as const,
  },
  heroLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: "12px",
    letterSpacing: "4px",
    textTransform: "uppercase" as const,
    color: C.gold,
    marginBottom: "32px",
    opacity: 0.9,
  },
  heroTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(38px, 6.5vw, 74px)",
    fontWeight: 700,
    lineHeight: 1.1,
    maxWidth: "900px",
    margin: "0 0 24px",
    letterSpacing: "-1px",
    color: C.textLight,
  },
  heroAccent: { color: C.gold, fontStyle: "italic" as const },
  heroSub: {
    fontSize: "clamp(16px, 2.1vw, 19px)",
    maxWidth: "620px",
    margin: "0 auto 48px",
    color: C.textMuted,
    lineHeight: 1.7,
    fontWeight: 400,
  },
  ctaPrimary: {
    padding: "16px 48px",
    background: C.gold,
    color: C.bg,
    border: "none",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    transition: "all 0.3s ease",
    borderRadius: "2px",
  },
  ctaSecondary: {
    padding: "16px 48px",
    background: "transparent",
    color: C.gold,
    border: `1px solid ${C.goldBorder}`,
    fontSize: "15px",
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    transition: "all 0.3s ease",
    borderRadius: "2px",
    marginLeft: "16px",
  },
  divider: {
    width: "60px",
    height: "1px",
    background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`,
    margin: "0 auto",
  },
  section: {
    padding: "100px 24px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  sectionLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: "11px",
    letterSpacing: "4px",
    textTransform: "uppercase" as const,
    color: C.gold,
    marginBottom: "20px",
    opacity: 0.8,
  },
  sectionTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(26px, 4.2vw, 46px)",
    fontWeight: 700,
    lineHeight: 1.15,
    marginBottom: "32px",
    color: C.textLight,
    maxWidth: "800px",
  },
  body: {
    fontSize: "17px",
    color: C.textMuted,
    lineHeight: 1.75,
    maxWidth: "680px",
    marginBottom: "20px",
  },
  highlight: { color: C.gold, fontWeight: 500 as const },
  pillarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "40px",
    marginTop: "56px",
  },
  pillar: {
    padding: "40px 32px",
    background: `linear-gradient(135deg, ${C.goldDim} 0%, rgba(212,168,83,0.01) 100%)`,
    border: `1px solid ${C.goldBorder}`,
    borderRadius: "4px",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  pillarNum: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "64px",
    fontWeight: 700,
    color: "rgba(212,168,83,0.07)",
    position: "absolute" as const,
    top: "12px",
    right: "20px",
    lineHeight: 1,
    userSelect: "none" as const,
  },
  pillarTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "22px",
    fontWeight: 600,
    color: C.textLight,
    marginBottom: "16px",
    lineHeight: 1.3,
  },
  pillarBody: {
    fontSize: "15px",
    color: C.textMuted,
    lineHeight: 1.7,
  },
  comparisonGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "32px",
    marginTop: "56px",
    alignItems: "start",
  },
  comparisonCard: (before: boolean) => ({
    padding: "36px 32px",
    background: before ? C.redDim : `linear-gradient(135deg, rgba(212,168,83,0.07), rgba(212,168,83,0.02))`,
    border: `1px solid ${before ? C.redBorder : C.goldBorderStrong}`,
    borderRadius: "4px",
  }),
  comparisonTitle: (before: boolean) => ({
    fontFamily: "'Space Mono', monospace",
    fontSize: "12px",
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: before ? C.red : C.gold,
    marginBottom: "24px",
  }),
  comparisonItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
    fontSize: "15px",
    color: C.textMuted,
    lineHeight: 1.5,
  },
  trustGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "32px",
    marginTop: "56px",
  },
  trustItem: {
    padding: "32px 28px",
    borderTop: `1px solid ${C.goldBorder}`,
  },
  trustTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "18px",
    color: C.textLight,
    marginBottom: "12px",
    fontWeight: 600,
  },
  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "24px",
    marginTop: "56px",
  },
  pricingCard: (featured: boolean) => ({
    padding: "44px 32px",
    background: featured
      ? `linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.03))`
      : "rgba(255,255,255,0.02)",
    border: `1px solid ${featured ? C.goldBorderStrong : "rgba(255,255,255,0.06)"}`,
    borderRadius: "4px",
    position: "relative" as const,
  }),
  pricingBadge: {
    position: "absolute" as const,
    top: "-1px",
    right: "24px",
    background: C.gold,
    color: C.bg,
    fontFamily: "'Space Mono', monospace",
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    padding: "6px 14px",
    fontWeight: 700,
  },
  pricingTier: {
    fontFamily: "'Space Mono', monospace",
    fontSize: "11px",
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: C.gold,
    marginBottom: "8px",
  },
  pricingPrice: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "42px",
    fontWeight: 700,
    color: C.textLight,
    marginBottom: "4px",
    lineHeight: 1.1,
  },
  pricingPeriod: {
    fontSize: "14px",
    color: C.textFaint,
    marginBottom: "20px",
  },
  pricingTagline: {
    fontSize: "15px",
    color: C.textMuted,
    marginBottom: "28px",
    lineHeight: 1.5,
    fontStyle: "italic" as const,
  },
  pricingFeature: {
    fontSize: "14px",
    color: C.textMuted,
    marginBottom: "12px",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    lineHeight: 1.5,
  },
  pricingCta: (active: boolean) => ({
    marginTop: "32px",
    padding: "14px 32px",
    width: "100%",
    background: active ? C.gold : "transparent",
    color: active ? C.bg : C.gold,
    border: active ? "none" : `1px solid ${C.goldBorder}`,
    fontSize: "13px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    transition: "all 0.3s ease",
    borderRadius: "2px",
  }),
  finalCta: {
    textAlign: "center" as const,
    padding: "100px 24px 130px",
    position: "relative" as const,
  },
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: "40px 24px",
    textAlign: "center" as const,
    fontFamily: "'Space Mono', monospace",
    fontSize: "11px",
    letterSpacing: "2px",
    color: C.textFaint,
  },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const whyDifferent = [
  ["You log data", "You log & ask"],
  ["You run reports", "You get answers"],
  ["Dashboards everywhere", "Conversational CFO"],
  ["Time tracking as a timer", "Job-level intelligence"],
  ["Accountants tell you later", "You know now"],
];

const pillars = [
  {
    num: "01",
    title: "Capture everything. Forget nothing.",
    body: "Log expenses, revenue, time, tasks, and receipts — by text, photo, voice, or email. Everything ties to a job automatically. No forms, no app switching, no nightly cleanup.",
    detail: (
      <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${C.goldBorder}` }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: C.gold, marginBottom: "14px", opacity: 0.7 }}>Capture methods</div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" as const }}>
          {["Text", "Voice", "Photo", "Email"].map((m) => (
            <span key={m} style={{ padding: "4px 12px", border: `1px solid ${C.goldBorder}`, borderRadius: "2px", fontSize: "12px", color: C.textMuted, fontFamily: "'Space Mono', monospace", letterSpacing: "1px" }}>{m}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: "02",
    title: "Run your business like a business.",
    body: "Create quotes, invoices, change orders, and receipts — conversationally. Every document connects to its job. Every signature is captured. Build the paper trail that protects you and builds trust.",
    detail: (
      <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${C.goldBorder}` }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: C.gold, marginBottom: "14px", opacity: 0.7 }}>Payroll-grade time tracking</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
          {[["Shift", "Clock in → out"], ["Break", "Separate"], ["Lunch", "Separate"], ["Drive", "Tracked"], ["Work", "Calculated"], ["Paid", "Your rules"]].map(([cat, note]) => (
            <div key={cat} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: C.textMuted, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ color: C.text }}>{cat}</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", opacity: 0.6 }}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: "03",
    title: "Ask Chief. Get the truth.",
    body: "\"Did Job 12 make money?\" \"What are my biggest expenses this month?\" Chief answers from your actual confirmed data — not guesses, not averages, not generic advice. Your numbers. Real answers.",
    detail: null,
  },
];

const scenarios = [
  {
    quote: "I thought Job 47 made money. Chief showed me it didn't — my material costs were 40% higher than I quoted. I fixed my pricing on the next bid and made $3,200 more.",
    author: "Pricing clarity",
  },
  {
    quote: "I used to spend Sunday nights doing spreadsheets. Now I text my receipts to Chief during the week and everything's sorted by job when I need it.",
    author: "Time saved",
  },
  {
    quote: "A client disputed a change order. I pulled up the signed document in 10 seconds. Conversation over.",
    author: "Protection",
  },
];

const plans = [
  {
    tier: "Free",
    name: "Field Capture",
    price: "$0",
    period: "forever",
    tagline: "Start logging. See how it feels.",
    featured: false,
    badge: null,
    features: [
      "3 active jobs",
      "Text-based capture",
      "3 Ask Chief questions / month",
      "Core time & expense tools",
      "30-day rolling history",
      "CSV export",
    ],
    cta: "Get Started",
  },
  {
    tier: "Owner Mode",
    name: "Owner Mode",
    price: "$59",
    period: "per month",
    tagline: "Run your jobs with real intelligence.",
    featured: true,
    badge: "Most Popular",
    features: [
      "15 active jobs",
      "Text, voice & photo capture",
      "50 Ask Chief questions / month",
      "Quotes, invoices & documents",
      "Email receipt forwarding",
      "PDF & Excel exports",
      "1-year history",
    ],
    cta: "Start Owner Mode",
  },
  {
    tier: "Crew + Control",
    name: "Crew + Control",
    price: "$149",
    period: "per month",
    tagline: "Scale your crew. Keep control.",
    featured: false,
    badge: null,
    features: [
      "Unlimited jobs",
      "200 Ask Chief questions / month",
      "Crew self-logging via WhatsApp",
      "Time approvals & edit requests",
      "Up to 25 admins",
      "Year-end export pack",
      "3-year history",
      "Priority support",
    ],
    cta: "Take Control",
  },
];

const faqs = [
  {
    q: "Is ChiefOS accounting software?",
    a: "No. ChiefOS is the operating system for running your business day-to-day — capturing time, money, and job activity as it happens. Export clean, structured data to your accountant whenever you need it.",
  },
  {
    q: "Do my workers need an app?",
    a: "No app download required. ChiefOS runs through WhatsApp. Your crew logs time and job activity from their phones using a chat they already have. You can also log for them.",
  },
  {
    q: "How does Chief answer questions?",
    a: "Chief answers only from confirmed, logged records — time entries, expenses, revenue, jobs. If important data is missing, Chief tells you what's missing instead of guessing.",
  },
  {
    q: "What if I log something wrong?",
    a: "ChiefOS is built to be repairable. Confirmation flows, undo actions, edit requests, approvals, and an audit trail mean corrections don't destroy trust or accuracy.",
  },
  {
    q: "Can I export my data?",
    a: "Yes, anytime, on any plan. CSV, XLS, and PDF for spreadsheets. Original receipt images, voice recordings, and job records all downloadable. Nothing trapped.",
  },
  {
    q: "Is my data private?",
    a: "Your business data is scoped to your account. Chief doesn't answer from other companies' data. Team members only see what their role allows.",
  },
  {
    q: "Does ChiefOS use AI?",
    a: "Yes. Chief uses AI to parse, organize, and reason over your logged records. It's designed to tell you when something is missing — it doesn't guess or hallucinate answers.",
  },
  {
    q: "Will my data be used to train AI?",
    a: "ChiefOS may use aggregated, de-identified data to improve the platform. We do not sell your business data and do not use raw customer records as public training data.",
  },
  {
    q: "Is ChiefOS replacing my accountant?",
    a: "No. ChiefOS helps you capture and structure records so that when you hand off to your accountant, the books are already clean. It does not replace professional accounting, tax, or legal advice.",
  },
  {
    q: "What exactly can I capture in WhatsApp?",
    a: "Text messages, voice notes, and receipt photos. Log expenses, revenue, time clock events, tasks, and job activity — all parsed and structured automatically.",
  },
  {
    q: "How fast can I get set up?",
    a: "Minutes. Start in WhatsApp, answer a few setup questions, create your first job, and start logging. Most users have their first entry in under five minutes.",
  },
  {
    q: "What if I already use other tools?",
    a: "Keep them. ChiefOS doesn't force a rip-and-replace. Capture and structure your work during the day, then export clean records into whatever tools you rely on for accounting or payroll.",
  },
  {
    q: "What happens if I stop using ChiefOS?",
    a: "Your data is yours. You can request a full export at any time. We do not hold your records hostage.",
  },
  {
    q: "Is ChiefOS in beta?",
    a: "Yes. The core product is stable and in active use. Features are expanding quickly — but the foundational goal stays constant: trusted capture, clean records, clear answers.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomepageClient() {
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(212,168,83,0.25); color: #F5F0E8; }
        @media (max-width: 700px) {
          .chiefos-comparison-grid { grid-template-columns: 1fr !important; }
          .chiefos-pricing-grid { grid-template-columns: 1fr !important; }
          .chiefos-nav { padding: 16px 20px !important; }
          .chiefos-hero-btns { flex-direction: column; align-items: center; gap: 12px !important; }
          .chiefos-hero-btns button { margin-left: 0 !important; width: 260px; }
          .chiefos-section { padding: 64px 20px !important; }
          .chiefos-why-table { font-size: 14px !important; }
          .chiefos-pillar-grid { grid-template-columns: 1fr !important; }
          .chiefos-trust-grid { grid-template-columns: 1fr !important; }
          .chiefos-scenario-grid { grid-template-columns: 1fr !important; }
          .chiefos-export-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={s.nav} className="chiefos-nav">
        <div style={s.logo}>CHIEFOS</div>
        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          <a href="/pricing" style={{ fontSize: "13px", color: C.textFaint, letterSpacing: "1px", textDecoration: "none" }}>Pricing</a>
          <a href="/login" style={{ fontSize: "13px", color: C.textFaint, letterSpacing: "1px", textDecoration: "none" }}>Sign in</a>
          <button style={s.navCta} onClick={() => { window.location.href = "/signup"; }}>Get Started</button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={s.hero}>
        <div style={s.heroGlow} />
        <FadeIn>
          <div style={s.heroLabel}>Contractor-Grade Intelligence</div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <h1 style={s.heroTitle}>
            Your Business Already Has the Answers.{" "}
            <span style={s.heroAccent}>Chief helps you hear them.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.3}>
          <p style={s.heroSub}>
            The tools you pay for separately — time tracking, expenses, quoting,
            invoicing — brought into one operating system that actually
            understands your business. Ask it anything. Get the truth.
          </p>
        </FadeIn>
        <FadeIn delay={0.45}>
          <div className="chiefos-hero-btns" style={{ display: "flex", gap: "0", alignItems: "center" }}>
            <button style={s.ctaPrimary} onClick={() => { window.location.href = "/signup"; }}>Get Started Free</button>
            <button style={s.ctaSecondary} onClick={() => { window.location.href = "/pricing"; }}>See Pricing</button>
          </div>
        </FadeIn>
      </section>

      <div style={s.divider} />

      {/* ── THE PROBLEM ─────────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>The Reality</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>
            You didn't start a business to do spreadsheets at midnight.
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p style={s.body}>
            You're running jobs, managing crew, ordering materials, dealing with
            clients. At the end of the day, most owners spend{" "}
            <span style={s.highlight}>30 minutes to 1.5 hours</span> cleaning
            receipts, updating spreadsheets, reconciling entries, and moving
            data between apps that don't talk to each other.
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <p style={s.body}>
            You stack apps. One for time tracking. One for invoicing. One for
            expenses. Maybe a spreadsheet to tie it all together.{" "}
            <span style={s.highlight}>None of them talk to each other.</span>{" "}
            You're paying for four tools and still doing the work yourself.
          </p>
        </FadeIn>
        <FadeIn delay={0.4}>
          <p style={s.body}>
            Meanwhile, Fortune 500 companies have entire finance teams and
            business intelligence systems doing exactly what you need —
            connecting all the numbers, explaining what's working, and flagging
            what isn't.
          </p>
        </FadeIn>
        <FadeIn delay={0.5}>
          <p style={{ ...s.body, color: C.gold, fontFamily: "'Playfair Display', serif", fontSize: "20px", fontStyle: "italic", marginTop: "40px", maxWidth: "640px" }}>
            That level of intelligence shouldn't require a Fortune 500 budget.
          </p>
        </FadeIn>

        {/* ── WHY DIFFERENT TABLE ──────────────────────────────────────── */}
        <FadeIn delay={0.15}>
          <div className="chiefos-why-table" style={{ marginTop: "56px", maxWidth: "640px" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", color: C.gold, marginBottom: "24px", opacity: 0.7 }}>How ChiefOS Changes the Loop</div>
            {whyDifferent.map(([before, after], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "15px" }}>
                <span style={{ color: C.textMuted, flex: "1 1 0", textAlign: "right" as const }}>{before}</span>
                <span style={{ color: C.gold, fontFamily: "'Space Mono', monospace", fontSize: "12px", flexShrink: 0 }}>→</span>
                <span style={{ color: C.textLight, flex: "1 1 0" }}>{after}</span>
              </div>
            ))}
            <div style={{ marginTop: "20px", fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: C.textFaint, fontSize: "14px" }}>
              Control → Clarity → Confidence
            </div>
          </div>
        </FadeIn>
      </section>

      <div style={s.divider} />

      {/* ── THREE PILLARS ───────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>What ChiefOS Does</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>One system. Every tool. Real answers.</h2>
        </FadeIn>
        <div style={s.pillarGrid} className="chiefos-pillar-grid">
          {pillars.map((pillar, i) => (
            <FadeIn key={i} delay={0.15 * (i + 1)}>
              <div style={s.pillar}>
                <div style={s.pillarNum}>{pillar.num}</div>
                <div style={s.pillarTitle}>{pillar.title}</div>
                <div style={s.pillarBody}>{pillar.body}</div>
                {pillar.detail}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* ── SEE IT IN ACTION ────────────────────────────────────────────── */}
      <section style={{ ...s.section, background: "linear-gradient(to bottom, transparent, rgba(212,168,83,0.02), transparent)" }} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>See It In Action</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>Ask a real question. Get a grounded answer.</h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p style={s.body}>
            Chief answers from your actual confirmed data — time, expenses,
            revenue, jobs. If something's missing, it tells you. It never
            guesses.
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <div style={{ marginTop: "40px", maxWidth: "680px", background: "#080807", border: `1px solid ${C.goldBorder}`, borderRadius: "4px", overflow: "hidden" }}>
            {/* Terminal header */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.goldBorder}`, display: "flex", alignItems: "center", gap: "8px" }}>
              {["#D05050", "#D0A030", "#50A050"].map((c) => (
                <div key={c} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.6 }} />
              ))}
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: C.textFaint, marginLeft: "8px", letterSpacing: "2px" }}>CHIEF — JOB INTELLIGENCE</span>
            </div>
            {/* Exchange */}
            <div style={{ padding: "28px 28px 32px" }}>
              <div style={{ marginBottom: "20px" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: C.textFaint, letterSpacing: "2px" }}>OWNER</span>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "15px", color: C.textLight, marginTop: "8px", lineHeight: 1.6 }}>
                  "Did Job 18 make money?"
                </div>
              </div>
              <div style={{ height: "1px", background: C.goldBorder, margin: "20px 0" }} />
              <div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: C.gold, letterSpacing: "2px" }}>CHIEF</span>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: C.textMuted, marginTop: "8px", lineHeight: 1.8 }}>
                  Job 18 shows{" "}
                  <span style={{ color: C.gold }}>$12,400 revenue</span> and{" "}
                  <span style={{ color: "#B45A5A" }}>$9,980 costs</span> from
                  confirmed entries.
                  <br />
                  <span style={{ color: C.textLight }}>→ $2,420 profit (+19.5%)</span>
                  <br />
                  <br />
                  <span style={{ opacity: 0.55, fontSize: "12px" }}>
                    Revenue entries: 5 &nbsp;·&nbsp; Cost entries: 21
                    &nbsp;·&nbsp; Time logged: 44.0h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.45}>
          <p style={{ ...s.body, marginTop: "24px", fontSize: "15px", fontStyle: "italic", color: C.textFaint }}>
            If something is missing, Chief tells you what's missing — it never fills the gap with a guess.
          </p>
        </FadeIn>
      </section>

      <div style={s.divider} />

      {/* ── WALL STREET MOMENT ──────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(to bottom, ${C.bg}, ${C.bgAlt}, ${C.bg})` }}>
        <section style={s.section} className="chiefos-section">
          <FadeIn>
            <div style={s.sectionLabel}>The Unlock</div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 style={s.sectionTitle}>
              The same financial clarity that billion-dollar companies rely on.
              Built for the job site.
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={s.body}>
              Big companies don't guess whether a project was profitable. They
              have CFOs, analysts, and business intelligence systems that track
              every dollar and explain exactly what happened and why.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <p style={s.body}>
              You deserve the same thing. Not a simplified version. Not a
              dumbed-down dashboard.{" "}
              <span style={s.highlight}>The real thing</span> — financial
              intelligence that connects your costs, revenue, labour, and jobs
              into a complete picture, then explains it to you in plain language.
            </p>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p style={{ ...s.body, color: C.gold, fontFamily: "'Playfair Display', serif", fontSize: "22px", fontStyle: "italic", marginTop: "40px", maxWidth: "720px" }}>
              ChiefOS is contractor-grade intelligence. It's not accounting
              software. It's not another app. It's the operating system your
              business has been missing.
            </p>
          </FadeIn>
        </section>
      </div>

      <div style={s.divider} />

      {/* ── BEFORE & AFTER ──────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>Before & After</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>
            Stop paying for five apps that don't talk to each other.
          </h2>
        </FadeIn>
        <div style={s.comparisonGrid} className="chiefos-comparison-grid">
          <FadeIn delay={0.2}>
            <div style={s.comparisonCard(true)}>
              <div style={s.comparisonTitle(true)}>Without ChiefOS</div>
              {[
                "Time tracking app — $15/mo",
                "Expense tracker — $10/mo",
                "Invoicing tool — $25/mo",
                "Quote builder — $20/mo",
                "Spreadsheets to connect it all — 10+ hrs/week",
                "None of it talks to each other",
                "You still don't know which jobs make money",
              ].map((item, i) => (
                <div key={i} style={s.comparisonItem}>
                  <span style={{ color: C.red, fontSize: "14px", marginTop: "3px", flexShrink: 0 }}>✕</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.35}>
            <div style={s.comparisonCard(false)}>
              <div style={s.comparisonTitle(false)}>With ChiefOS</div>
              {[
                "Everything in one operating system",
                "All data tied to your jobs automatically",
                "Capture by text, voice, photo, or email",
                "Quotes, invoices, and receipts — built in",
                "Ask Chief and get real financial answers",
                "Export-ready for your accountant",
                "One price. No stack. No spreadsheet nights.",
              ].map((item, i) => (
                <div key={i} style={s.comparisonItem}>
                  <span style={{ color: C.gold, fontSize: "14px", marginTop: "3px", flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <div style={s.divider} />

      {/* ── TRUST & TRANSPARENCY ────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>Protect Your Business</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>When your business is organized, everybody wins.</h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p style={s.body}>
            Your clients get clear quotes, professional invoices, and documented
            change orders. No surprises. No "I thought we agreed on…"
            conversations. Every change is signed. Every payment tracked.
          </p>
        </FadeIn>
        <div style={s.trustGrid} className="chiefos-trust-grid">
          {[
            {
              title: "For your clients",
              body: "Transparent pricing, professional documents, signed change orders. Trust builds referrals. Disputes become rare — and when they happen, the truth is already documented.",
            },
            {
              title: "For your business",
              body: "A complete paper trail. If there's ever a dispute, the signed record is in your pocket. Pull it up in ten seconds. Conversation over.",
            },
            {
              title: "For your sanity",
              body: "Stop carrying your business in your head. Chief remembers everything you've logged so you don't have to — and tells you what's there and what's missing.",
            },
          ].map((item, i) => (
            <FadeIn key={i} delay={0.15 * (i + 1)}>
              <div style={s.trustItem}>
                <div style={s.trustTitle}>{item.title}</div>
                <div style={{ fontSize: "14px", color: C.textMuted, lineHeight: 1.7 }}>{item.body}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* ── SCENARIOS ───────────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>What Contractors Are Discovering</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>Real moments. Real answers.</h2>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "32px", marginTop: "56px" }} className="chiefos-scenario-grid">
          {scenarios.map((sc, i) => (
            <FadeIn key={i} delay={0.15 * (i + 1)}>
              <div style={{ padding: "36px 32px", background: "rgba(212,168,83,0.03)", borderLeft: `2px solid ${C.goldBorderStrong}`, borderRadius: "0 4px 4px 0" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", fontStyle: "italic", color: C.text, lineHeight: 1.65, marginBottom: "16px" }}>
                  "{sc.quote}"
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: C.gold, opacity: 0.7 }}>{sc.author}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* ── EXPORTS ─────────────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>Your Data</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>Your data is yours. Export anytime. Nothing trapped.</h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p style={s.body}>
            Clean records in. Clean exports out. Every plan includes full data
            portability — your accountant, your payroll, your backup. One system
            in. We do not hold your information hostage.
          </p>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginTop: "48px" }} className="chiefos-export-grid">
          {[
            {
              title: "Spreadsheets",
              body: "Expenses, time, jobs, tasks — clean totals and line items.",
              formats: "CSV · XLS · PDF",
            },
            {
              title: "Receipt images",
              body: "Download original attachments linked to the exact entry.",
              formats: "JPG · PNG · ZIP",
            },
            {
              title: "Voice recordings",
              body: "Download audio files plus the structured entry they produced.",
              formats: "MP3 · M4A · ZIP",
            },
          ].map((item, i) => (
            <FadeIn key={i} delay={0.12 * (i + 1)}>
              <div style={{ padding: "28px 24px", borderTop: `1px solid ${C.goldBorder}` }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", color: C.textLight, marginBottom: "10px", fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: "14px", color: C.textMuted, lineHeight: 1.65, marginBottom: "12px" }}>{item.body}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: C.gold, opacity: 0.6, letterSpacing: "1px" }}>{item.formats}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* ── PRICING ─────────────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>Simple Pricing</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={s.sectionTitle}>Plans that grow with your operation.</h2>
        </FadeIn>
        <FadeIn delay={0.15}>
          <p style={s.body}>Your data is yours. Export everything, anytime, on every plan.</p>
        </FadeIn>
        <div style={s.pricingGrid} className="chiefos-pricing-grid">
          {plans.map((plan, i) => (
            <FadeIn key={i} delay={0.15 * (i + 1)}>
              <div
                style={s.pricingCard(plan.featured)}
                onMouseEnter={() => setHoveredPlan(i)}
                onMouseLeave={() => setHoveredPlan(null)}
              >
                {plan.badge && <div style={s.pricingBadge}>{plan.badge}</div>}
                <div style={s.pricingTier}>{plan.tier}</div>
                <div style={s.pricingPrice}>{plan.price}</div>
                <div style={s.pricingPeriod}>{plan.period}</div>
                <div style={s.pricingTagline}>{plan.tagline}</div>
                {plan.features.map((f, fi) => (
                  <div key={fi} style={s.pricingFeature}>
                    <span style={{ color: C.gold, fontSize: "12px", marginTop: "3px", flexShrink: 0 }}>◆</span>
                    <span>{f}</span>
                  </div>
                ))}
                <button style={s.pricingCta(plan.featured || hoveredPlan === i)}>
                  {plan.cta}
                </button>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section style={s.section} className="chiefos-section">
        <FadeIn>
          <div style={s.sectionLabel}>Common Questions</div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 style={{ ...s.sectionTitle, marginBottom: "48px" }}>Everything you want to know.</h2>
        </FadeIn>
        <div style={{ maxWidth: "760px" }}>
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={0.05}>
              <div
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 0", gap: "24px" }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", color: openFaq === i ? C.textLight : C.text, fontWeight: openFaq === i ? 600 : 400, lineHeight: 1.4, transition: "color 0.2s" }}>
                    {faq.q}
                  </span>
                  <span style={{ color: C.gold, fontFamily: "'Space Mono', monospace", fontSize: "14px", flexShrink: 0, transition: "transform 0.3s", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)", display: "inline-block" }}>+</span>
                </div>
                <div style={{ overflow: "hidden", maxHeight: openFaq === i ? "400px" : "0", transition: "max-height 0.4s ease", paddingBottom: openFaq === i ? "20px" : "0" }}>
                  <p style={{ fontSize: "15px", color: C.textMuted, lineHeight: 1.75 }}>{faq.a}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div style={s.divider} />

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section style={s.finalCta}>
        <div style={{ position: "absolute", bottom: "-100px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(212,168,83,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <FadeIn>
          <div style={s.sectionLabel}>Your Business Is Talking</div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <h2 style={{ ...s.sectionTitle, textAlign: "center", margin: "0 auto 24px", maxWidth: "680px" }}>
            Start free. Log your first receipt.{" "}
            <span style={s.heroAccent}>See what Chief tells you.</span>
          </h2>
        </FadeIn>
        <FadeIn delay={0.3}>
          <p style={{ ...s.body, textAlign: "center", margin: "0 auto 48px" }}>
            No credit card. No commitment. No app to download. Just WhatsApp and
            the truth about your business.
          </p>
        </FadeIn>
        <FadeIn delay={0.45}>
          <button style={{ ...s.ctaPrimary, padding: "18px 64px", fontSize: "16px" }} onClick={() => { window.location.href = "/signup"; }}>
            Get Started Free
          </button>
        </FadeIn>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <SiteFooter
        brandLine="The operating system for contractors."
        subLine="One system for time, expenses, jobs, and invoicing — powered by AI."
      />
    </div>
  );
}
