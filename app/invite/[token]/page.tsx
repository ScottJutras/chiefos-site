"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InviteDetails = {
  id: string;
  employee_name: string;
  role: string;
  business_name: string;
  expires_at: string;
  expired: boolean;
  claimed: boolean;
};

type Phase =
  | "loading"
  | "invalid"
  | "expired"
  | "claimed"
  | "show-invite"
  | "sending-magic"
  | "check-email"
  | "claiming"
  | "done"
  | "error";

function InviteClaimInner() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const token = String(params?.token || "").trim();
  // Always attempt auto-claim on load. tryAutoClaim polls briefly for a
  // Supabase session (handles the magic-link hash hydration race) and
  // falls back to showing the invite card if none is found — so cold
  // visits behave the same as before.
  const shouldClaim = true;

  const [phase, setPhase] = useState<Phase>("loading");
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [email, setEmail] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const claimedRef = useRef(false);

  // ── 1. Load invite details ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }

    (async () => {
      try {
        const r = await fetch(`/api/invite/${token}`);
        const body = await r.json();
        if (!body?.ok || !body.invite) {
          setPhase("invalid");
          return;
        }
        const inv: InviteDetails = body.invite;
        setInvite(inv);

        if (inv.expired) { setPhase("expired"); return; }
        if (inv.claimed) { setPhase("claimed"); return; }

        // If we got here via magic-link redirect with ?claim=1, auto-claim
        if (shouldClaim) {
          await tryAutoClaim(inv);
        } else {
          setPhase("show-invite");
        }
      } catch (e: any) {
        setErrMsg(String(e?.message || "Could not load invite."));
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, shouldClaim]);

  // ── 2. Auto-claim after magic-link redirect ─────────────────────────────────
  async function tryAutoClaim(inv?: InviteDetails | null) {
    if (claimedRef.current) return;
    claimedRef.current = true;

    setPhase("claiming");

    // Poll for Supabase session (magic-link auth may take a moment to hydrate)
    let sessionToken = "";
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      try {
        const { data } = await supabase.auth.getSession();
        sessionToken = data?.session?.access_token || "";
        if (sessionToken) break;
      } catch {
        // ignore transient errors
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!sessionToken) {
      // No session → user needs to log in first
      claimedRef.current = false;
      setPhase("show-invite");
      return;
    }

    try {
      const r = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
      });
      const body = await r.json();

      if (!body?.ok && r.status !== 409) {
        // 409 = already claimed by this user — treat as success
        setErrMsg(body?.message || "Could not accept invite.");
        setPhase("error");
        return;
      }

      setPhase("done");
      // Give user a moment to read the success message, then redirect
      setTimeout(() => {
        router.replace("/app/dashboard");
      }, 2500);
    } catch (e: any) {
      setErrMsg(String(e?.message || "Could not claim invite."));
      setPhase("error");
    }
  }

  // ── 3. Send magic link ──────────────────────────────────────────────────────
  async function sendMagicLink() {
    const em = email.trim().toLowerCase();
    if (!em) return;

    setPhase("sending-magic");
    setErrMsg("");

    try {
      const base = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://app.usechiefos.com").replace(/\/$/, "");
      const redirectTo = `${base}/auth/callback?returnTo=${encodeURIComponent(`/invite/${token}?claim=1`)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: em,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setPhase("check-email");
    } catch (e: any) {
      setErrMsg(String(e?.message || "Could not send email."));
      setPhase("show-invite");
    }
  }

  // ── 4. If already logged in, claim directly ─────────────────────────────────
  async function claimNow() {
    await tryAutoClaim(invite);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="text-[#D4A853]">Chief</span>
            <span className="text-white/60 text-sm font-normal">by Sherpa AI</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0F0E0C] p-6">
          {phase === "loading" && (
            <div className="text-sm text-white/60">Loading invite…</div>
          )}

          {phase === "invalid" && (
            <>
              <div className="font-semibold text-red-300">Invalid invite</div>
              <div className="mt-2 text-sm text-white/60">
                This invite link is not valid or has been removed.
              </div>
            </>
          )}

          {phase === "expired" && (
            <>
              <div className="font-semibold text-yellow-300">Invite expired</div>
              <div className="mt-2 text-sm text-white/60">
                This invite link expired. Ask the owner to send a new one.
              </div>
            </>
          )}

          {phase === "claimed" && (
            <>
              <div className="font-semibold text-white/60">Already claimed</div>
              <div className="mt-2 text-sm text-white/60">
                This invite has already been accepted.{" "}
                <a href="/login" className="text-[#D4A853] hover:underline">Sign in</a> to access your account.
              </div>
            </>
          )}

          {(phase === "show-invite" || phase === "sending-magic" || phase === "check-email") && invite && (
            <>
              <div className="text-xs font-medium uppercase tracking-widest text-[#D4A853] mb-3">
                You've been invited
              </div>
              <div className="font-semibold text-white text-lg leading-snug">
                {invite.employee_name}, join{" "}
                <span className="text-[#D4A853]">{invite.business_name}</span> on ChiefOS
              </div>
              <div className="mt-1 text-sm text-white/50 capitalize">
                Role: {invite.role}
              </div>

              {phase === "check-email" ? (
                <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                  Check your email — we sent a sign-in link to <strong>{email}</strong>.
                  Click the link in the email to accept this invite.
                </div>
              ) : (
                <div className="mt-6">
                  <div className="text-sm text-white/60 mb-3">
                    Enter your email to accept this invite and set up your ChiefOS account:
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendMagicLink(); }}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                  />

                  {errMsg && (
                    <div className="mt-2 text-xs text-red-300">{errMsg}</div>
                  )}

                  <button
                    onClick={sendMagicLink}
                    disabled={phase === "sending-magic" || !email.trim()}
                    className={[
                      "mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition",
                      phase === "sending-magic" || !email.trim()
                        ? "bg-[#D4A853]/30 text-white/40 cursor-not-allowed"
                        : "bg-[#D4A853] text-[#0C0B0A] hover:bg-[#e0b860]",
                    ].join(" ")}
                  >
                    {phase === "sending-magic" ? "Sending…" : "Send sign-in link"}
                  </button>

                  <div className="mt-4 text-center text-xs text-white/40">
                    Already have an account?{" "}
                    <button
                      onClick={claimNow}
                      className="text-[#D4A853] hover:underline"
                    >
                      Accept as current user
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {phase === "claiming" && (
            <div className="text-sm text-white/60">Accepting invite…</div>
          )}

          {phase === "done" && invite && (
            <>
              <div className="font-semibold text-white">Welcome to {invite.business_name}!</div>
              <div className="mt-2 text-sm text-white/60">
                Your account is ready. Redirecting to your dashboard…
              </div>
            </>
          )}

          {phase === "error" && (
            <>
              <div className="font-semibold text-red-300">Something went wrong</div>
              <div className="mt-2 text-sm text-white/60">{errMsg || "Unable to process this invite."}</div>
              <div className="mt-3 text-sm text-white/40">
                Try refreshing the page or contact support.
              </div>
            </>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-white/30">
          ChiefOS — AI-native operating system for small businesses
        </div>
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8] flex items-center justify-center p-4">
        <div className="text-sm text-white/60">Loading…</div>
      </main>
    }>
      <InviteClaimInner />
    </Suspense>
  );
}
