import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/auth/signup — TEMPORARILY GATED (post-rebuild onboarding refactor)
//
// The pre-rebuild signup flow wrote to public.chiefos_pending_signups, which
// was DISCARDed in the rebuild per FOUNDATION_P1_SCHEMA_DESIGN_FULL.md §6.1
// Decision 1 ("Supabase Auth + users.signup_status handles"). Re-implementing
// requires a coordinated refactor across 6 files plus a new PG RPC
// (chiefos_finish_signup) that creates tenant + portal_user + public.users
// atomically.
//
// Tracked as P1 in POST_CUTOVER_PUNCHLIST.md ("Onboarding refactor (post-rebuild
// Path α)"). WhatsApp capture (the alternate path) is unaffected.
// Surfaced 2026-04-28 during cutover-integration-parity Bundle 3.
// ─────────────────────────────────────────────────────────────────────────────

function gated() {
  return NextResponse.json(
    {
      ok: false,
      error: "onboarding_temporarily_unavailable",
      message:
        "Portal signup is being refactored to align with the post-rebuild " +
        "schema. WhatsApp capture flows are fully operational. Onboarding " +
        "will return shortly.",
      issue: "post-rebuild-onboarding-refactor-p1",
    },
    { status: 503 }
  );
}

export async function POST() { return gated(); }
export async function GET()  { return gated(); }
