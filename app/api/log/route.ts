import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// /api/log — TEMPORARILY GATED (post-rebuild schema drift)
//
// This route is the owner job-detail page's primary write path for
// expense / revenue / hours / task / reminder entries. The pre-rebuild
// implementation has multiple layers of schema drift that all need fixing
// in a coordinated rewrite:
//
//   1. Identity resolution via chiefos_tenant_actor_profiles
//      (DISCARDed per rebuild Decision 12).
//   2. transactions inserts use legacy `amount` / `payee_name` /
//      `expense_category` / `user_name` / `job_name` columns (rebuild
//      schema only has `amount_cents` / `description` / `merchant`).
//   3. time_entries inserts target the legacy `time_entries` table
//      (post-rebuild canonical is `time_entries_v2` with
//      `start_at_utc` / `end_at_utc` / `kind`).
//   4. tasks inserts use the dropped `created_by` column and set
//      `status: 'pending'` which is not in the post-rebuild 4-value
//      enum {open, in_progress, done, cancelled}.
//
// Every call to this route was 500-erroring against the new database.
// The 503 below is an honest stand-in until the full rewrite ships;
// WhatsApp capture (the alternate path) is unaffected and continues
// to work via routes/webhook.js.
//
// Tracked as P1 in POST_CUTOVER_PUNCHLIST.md ("/api/log full schema-drift
// rewrite"). Surfaced 2026-04-27 during cutover-integration-parity audit.
// ─────────────────────────────────────────────────────────────────────────────

function gated() {
  return NextResponse.json(
    {
      ok: false,
      error: "log_route_temporarily_unavailable",
      message:
        "Portal data entry is being updated for the post-rebuild schema. " +
        "Please use WhatsApp to capture expenses, revenue, hours, tasks, " +
        "and reminders for now. The portal forms will return shortly.",
      issue: "post-rebuild-log-route-rewrite",
    },
    { status: 503 }
  );
}

export async function POST() { return gated(); }
export async function GET()  { return gated(); }
