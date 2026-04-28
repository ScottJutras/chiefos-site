import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/auth/pending-signup — TEMPORARILY GATED (post-rebuild onboarding refactor)
//
// Both GET and POST (set-tenant-meta + consume) read/write the DISCARDed
// chiefos_pending_signups table. Replacement model per
// FOUNDATION_P1_SCHEMA_DESIGN_FULL.md Decision 1:
//   - Pre-tenant metadata → auth.users.raw_user_meta_data (Supabase Auth)
//   - Post-tenant legal → chiefos_legal_acceptances (works as-is)
//   - Lifecycle state → public.users.signup_status enum
//   - Atomic tenant creation → new chiefos_finish_signup PG RPC (P1 punchlist)
//
// Tracked as P1 in POST_CUTOVER_PUNCHLIST.md ("Onboarding refactor (post-rebuild
// Path α)"). WhatsApp capture flows are unaffected.
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

export async function GET()  { return gated(); }
export async function POST() { return gated(); }
