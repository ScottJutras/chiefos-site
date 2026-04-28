import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// /api/tester-access/activate — TEMPORARILY GATED (post-rebuild onboarding refactor)
//
// Pre-rebuild flow read user_auth_links (DROPPED — replaced by
// chiefos_portal_users + users.auth_user_id) and wrote
// users.subscription_tier / users.paid_tier (DROPPED — replaced by
// users.plan_key). Both surfaces require coordinated refactor in the
// dedicated onboarding PR (P1 punchlist).
//
// Tracked as P1 in POST_CUTOVER_PUNCHLIST.md ("Onboarding refactor (post-rebuild
// Path α)"). WhatsApp capture flows are unaffected; tester entitlement on
// chiefos_beta_signups is preserved (the canonical-plan-write step is what's
// gated).
// Surfaced 2026-04-28 during cutover-integration-parity Bundle 3.
// ─────────────────────────────────────────────────────────────────────────────

function gated() {
  return NextResponse.json(
    {
      ok: false,
      error: "onboarding_temporarily_unavailable",
      message:
        "Tester activation is being refactored to align with the post-rebuild " +
        "schema. WhatsApp capture flows are fully operational. Onboarding " +
        "will return shortly.",
      issue: "post-rebuild-onboarding-refactor-p1",
    },
    { status: 503 }
  );
}

export async function POST() { return gated(); }
