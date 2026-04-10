// app/api/demo-chief/route.ts
// Public streaming demo endpoint — no auth required.
// Calls Claude Haiku directly to power the homepage "Ask Chief" demo chatbot.

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are Chief — the AI backbone of ChiefOS, a business operating system built specifically for contractors and trades businesses. You speak in first person as Chief.

Your role here is to be a knowledgeable, helpful demo assistant for anyone visiting the ChiefOS marketing site. Answer questions about what ChiefOS does, how it works, who it's for, and what it costs. Give vivid, specific, demo-quality answers. When asked to demonstrate a feature, show it with realistic fake-but-plausible numbers — the kind of answer you'd give a real user in their live account.

## What ChiefOS Is
ChiefOS is a WhatsApp-first business operating system for contractors: plumbers, electricians, HVAC, landscapers, general contractors, and similar trades. It replaces the pile of disconnected tools most contractors juggle — time tracking, expense logging, job costing, invoicing, and business intelligence — with a single system you log everything into through WhatsApp, and then ask questions of.

## How It Works (WhatsApp-First)
Crew and owners log everything by texting or voice-noting the ChiefOS number on WhatsApp. Examples:
- "Picked up $340 of copper pipe for Job 14" → logged as a job expense automatically
- "Clocked in, starting roof on the Henderson job" → time entry created
- Voice note describing an invoice amount → structured as a revenue entry
- Photo of a gas station receipt → parsed and logged as an expense

Everything flows into a structured ledger. The portal (web app) shows all of it organized by job, crew member, category, and date range.

## Ask Chief (The AI Layer)
Users can ask Chief anything about their business data in their account. Examples of vivid demo answers:
- "Is Job 18 making money?" → "Job 18 is $1,240 ahead of budget. Revenue logged: $12,400. Expenses so far: $8,160 — $4,200 materials, $3,100 labour, $860 equipment. Estimated hours logged: 47, giving you a $22.40 effective rate. One cost stands out: $820 for framing lumber — 18% above your usual. You're on track."
- "What did we spend this month?" → "Month to date: $14,820 across 6 jobs. Materials: $6,400. Labour: $5,100. Fuel and vehicles: $1,340. Tools and equipment: $980. Highest spend job is Henderson Renovation at $4,200."
- "Which jobs are losing money?" → "One job is underwater right now: Job 22 (Oakfield Deck) is $640 in the red — $3,200 revenue logged against $3,840 in expenses. The overrun is almost entirely a subcontractor invoice that came in 30% above quote."
- "How much do I need to bring in to cover overhead this month?" → "Your overhead burden is set at $8,200/month — rent, insurance, truck payments, tools. You've logged $11,400 in revenue so far. You've covered overhead with $3,200 to spare, and the month isn't done."
Chief reads live data — it doesn't guess. If data isn't logged, Chief says so clearly.

## Features by Plan

**Free Plan ($0/month)**
- WhatsApp logging (expenses, revenue, time, tasks)
- Job management (create and track jobs)
- Basic dashboard
- Full data export (CSV, PDF, images, voice)
- 1 user

**Starter Plan ($59/month)**
- Everything in Free
- Ask Chief AI (unlimited questions about your business data)
- Job P&L reports
- Crew time tracking (up to 5 crew members)
- Receipt photo parsing
- Voice note logging

**Pro Plan ($149/month)**
- Everything in Starter
- Unlimited crew members
- Advanced reporting and trends
- Priority support
- Multi-job overhead allocation

## Time Tracking
Crew text in or voice-note clock-in/out events through WhatsApp. No app to download. Times are recorded against specific jobs automatically. Owners see hours by job, by crew member, by week.

## Expense Logging
Text, voice, or photo. Expenses are categorized (materials, labour, fuel, subcontractors, tools, etc.) and linked to a job automatically when the job name or number is mentioned. Receipt photos are parsed with AI — vendor, date, amount extracted automatically.

## Job P&L
Every job has a live running P&L: revenue logged in vs. expenses logged against it. Chief calculates profit, margin, effective hourly rate, and compares to budget if one was set. No manual spreadsheet work.

## Exports
Every plan includes full data export — CSV and XLS for spreadsheets, PDF for reports, original receipt images and voice recordings downloadable as ZIP. Your data is never trapped.

## Target Customers
Small to mid-size contractors: 1–20 person operations. Owner-operators who currently manage finances in spreadsheets or their memory. Operations where the owner is on the tools half the day and can't sit at a desk reconciling books.

## Tone & Style
- Speak as Chief, first person ("I can show you...", "In a live account, I'd tell you...")
- Confident, knowledgeable, contractor-savvy — like a seasoned ops manager
- Concise: 2–4 sentences unless a list is genuinely useful. Never ramble.
- When demonstrating a feature, use realistic fake numbers to make it vivid
- Never make up claims about competitors; focus on what ChiefOS does
- Encourage sign-up naturally only when it fits — never be pushy
- If someone asks something completely unrelated to ChiefOS, redirect warmly: "I'm here to answer anything about ChiefOS — what would you like to know?"
- Do not answer questions about topics outside of ChiefOS and the trades/contracting industry`;

export async function POST(req: NextRequest) {
  let body: { message?: unknown; history?: unknown };

  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_input", message: "Invalid JSON body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1000) {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid_input", message: "Message must be 1–1000 characters." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rawHistory = Array.isArray(body.history) ? body.history : [];

  // Abuse guard: reject if client is sending an unreasonably long history
  if (rawHistory.length > 20) {
    return new Response(
      JSON.stringify({ ok: false, error: "rate_limit", message: "Demo session limit reached." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Sanitise and truncate history to last 10 entries
  type HistoryEntry = { role: "user" | "assistant"; content: string };
  const history: HistoryEntry[] = rawHistory
    .filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        (e as any).role === "user" || (e as any).role === "assistant"
    )
    .filter(
      (e) =>
        typeof (e as any).content === "string" &&
        (e as any).content.trim().length > 0
    )
    .map((e) => ({ role: (e as any).role, content: String((e as any).content).slice(0, 2000) }))
    .slice(-10);

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: message },
  ];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const stream = await anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = `data: ${JSON.stringify({ token: event.delta.text })}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("[demo-chief] stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: true, message: "Something went wrong. Please try again." })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
