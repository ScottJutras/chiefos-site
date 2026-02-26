// chiefos-site/lib/askChiefPrompts.ts

export type PromptGroup = {
  title: string;
  subtitle?: string;
  prompts: string[];
  notes?: string[];
  status?: "Works now" | "Target next" | "Should gate on Free" | "Not supported";
};

export const ASK_CHIEF_GROUPS: PromptGroup[] = [
  {
    title: "Best demo questions (monetization core)",
    subtitle: "High-confidence, high-conversion prompts",
    status: "Works now",
    prompts: [
      "What did I spend this week?",
      "What’s my profit MTD?",
      "Which job is most profitable?",
      "How many hours did we log this week?",
      "Am I making money this month?",
    ],
    notes: [
      "These should route to deterministic totals (not glossary/RAG).",
      "If data is missing, Chief must say what’s missing.",
    ],
  },
  {
    title: "Business totals (fast copy/paste)",
    subtitle: "Short forms that should feel instant",
    status: "Works now",
    prompts: [
      "spend today",
      "revenue today",
      "profit today",
      "spend last 7 days",
      "revenue last 7 days",
      "profit last 7 days",
      "spend last 30 days",
      "revenue last 30 days",
      "profit last 30 days",
      "What is my profit last 7 days",
      "What is my revenue today",
      "How much did I spend today",
    ],
    notes: ["Routing sanity checks — must go to totals, not definitions."],
  },
  {
    title: "Job profit (name + number + active job)",
    subtitle: "Strong job-first CFO moment",
    status: "Works now",
    prompts: [
      "profit on 1556",
      "profit on job #1556",
      "profit on 1556 Medway Park Dr",
      "profit on Oak Street Re-roof",
      "profit on active job",
      "How much did Job 1559 Medway Park bring in?",
      "What’s the profit on Job 1559?",
      "How much did we spend on 1559 Medway Park?",
    ],
    notes: [
      "If job is ambiguous → Chief must ask which one (never guess).",
      "If job doesn’t exist → say it couldn’t find it.",
    ],
  },
  {
    title: "Ambiguity / not found behavior (should clarify, not guess)",
    status: "Works now",
    prompts: ["profit on 15", "profit on Fake Job Name"],
    notes: [
      "If multiple matches → ask a clarifying question.",
      "If none → say “couldn’t find” + suggest examples.",
    ],
  },
  {
    title: "Cash & profit (safe + strong in v0)",
    status: "Works now",
    prompts: [
      "How much revenue did I make this week?",
      "What’s my revenue MTD?",
      "Revenue YTD?",
      "How much cash came in today?",
      "What did we invoice this month?",
      "What did I spend this week?",
      "What were my expenses MTD?",
      "Show me my biggest expense this week.",
      "How much did I spend on fuel this month?",
      "What’s my net this month?",
      "Am I profitable this week?",
      "What’s my gross profit YTD?",
    ],
    notes: ["Ground answers in your canonical ledger + totals."],
  },
  {
    title: "Time & labor (if timeclock entries exist)",
    status: "Works now",
    prompts: [
      "How many hours did we log this week?",
      "How many hours did Scott work today?",
      "What’s my labor this month?",
      "How many unapproved time entries do we have?",
      "How many hours are unbilled?",
    ],
    notes: ["If approvals/unbilled aren’t wired, Chief must say so (or return partial)."],
  },
  {
    title: "Job-level breakdowns (strong use case)",
    status: "Target next",
    prompts: [
      "Show me revenue vs expenses by job.",
      "Which job has the highest costs this month?",
      "What’s the margin on Mission Exteriors?",
      "Which job is most profitable?",
    ],
    notes: ["If not implemented, return what you can + what’s missing."],
  },
  {
    title: "Simple comparisons (safe if aggregates exist)",
    status: "Target next",
    prompts: [
      "Is this week better than last week?",
      "Are we up or down from last month?",
      "What’s my average weekly revenue?",
      "What’s my biggest cost category?",
    ],
    notes: [
      "Only answer if comparison ranges + stable aggregation exist.",
      "Otherwise: say not supported yet + offer supported totals.",
    ],
  },
  {
    title: "KPI / CFO prompts (should gate on Free)",
    status: "Should gate on Free",
    prompts: [
      "What are my KPIs?",
      "How’s cash flow?",
      "What’s hurting my profit?",
      "What should I be watching this week?",
      "Where am I leaking money?",
      "Am I on track this month?",
      "What’s my break-even revenue?",
      "What’s my revenue per labor hour?",
      "What’s my overhead this month?",
      "What’s my labor burden?",
      "What’s my average job size?",
    ],
    notes: [
      "If plan doesn’t allow reasoning → gate calmly + offer a supported sample.",
      "If allowed but data is missing → say what’s missing.",
    ],
  },
  {
    title: "What Chief should NOT answer yet (v0 reality)",
    status: "Not supported",
    prompts: [
      "Tax filing advice",
      "HST remittance calculations (unless explicitly implemented)",
      "External market data",
      "Forecasting beyond basic trend extrapolation",
      "Payroll tax compliance",
      "Industry benchmarking (unless explicitly wired)",
    ],
    notes: ["If asked, refuse politely and explain scope."],
  },
];