"use client";

import Link from "next/link";

export default function CrewHomePage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-2 py-3">
      <h1 className="text-xl font-semibold tracking-tight">Crew</h1>
      <div className="mt-1 text-sm text-white/70">Manage members, board reviewers, and approvals.</div>

      <div className="mt-4 grid gap-3">
        <Link
          href="/app/crew/inbox"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition"
        >
          <div className="font-semibold">Crew Inbox</div>
          <div className="text-sm text-white/70 mt-1">Approve, reject, or request clarification.</div>
        </Link>

        <Link
          href="/app/crew/members"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition"
        >
          <div className="font-semibold">Members & Board</div>
          <div className="text-sm text-white/70 mt-1">Add employees, promote to board, and assign reviewers.</div>
        </Link>
      </div>
    </div>
  );
}