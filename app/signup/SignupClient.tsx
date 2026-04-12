"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/app/components/SiteHeader";
import TurnstileBox from "@/app/components/TurnstileBox";
import { normalizeAuthMessage } from "@/lib/authErrors";
import LegalAgreementModal from "@/app/legal/LegalAgreementModal";
import {
  LEGAL_AI_POLICY_VERSION,
  LEGAL_DPA_VERSION,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "@/app/legal/LegalAgreementContent";

type Plan = "free" | "starter" | "pro";

function cleanPlan(x: string | null): Plan | null {
  const s = String(x || "").trim().toLowerCase();
  if (s === "free" || s === "starter" || s === "pro") return s;
  return null;
}

async function track(event: string, payload: Record<string, any> = {}) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, payload }),
    });
  } catch {}
}

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.47A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-4.27 5.01" />
      <path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4.12-.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function passwordChecks(pw: string) {
  const s = pw || "";
  return {
    len: s.length >= 10,
    upper: /[A-Z]/.test(s),
    lower: /[a-z]/.test(s),
    num: /\d/.test(s),
    sym: /[^A-Za-z0-9]/.test(s),
  };
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={["h-2 w-2 rounded-full", ok ? "bg-emerald-500" : "bg-[#706A60]"].join(" ")} />
      <span className={ok ? "text-[#D4A853]" : "text-[#706A60]"}>{label}</span>
    </div>
  );
}

export default function SignupClient() {
  const sp = useSearchParams();

  const prefillEmail = useMemo(() => (sp.get("email") || "").trim(), [sp]);
  const prefillName = useMemo(() => (sp.get("name") || "").trim(), [sp]);
  const prefillPlan = useMemo(() => cleanPlan(sp.get("plan")), [sp]);
  const signupMode = useMemo(() => (sp.get("mode") || "").trim().toLowerCase(), [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState<"CA" | "US" | "">("");
  const [province, setProvince] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const [agreeLegal, setAgreeLegal] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalAcceptedAt, setLegalAcceptedAt] = useState<string | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (prefillEmail) setEmail((cur) => cur || prefillEmail);
    if (prefillName) setCompanyName((cur) => cur || prefillName);

    if (typeof window !== "undefined") {
      if (prefillPlan) {
        localStorage.setItem("chiefos_selected_plan", prefillPlan);
      }

      if (signupMode === "tester") {
        localStorage.setItem("chiefos_signup_mode", "tester");
      } else {
        localStorage.removeItem("chiefos_signup_mode");
      }
    }
  }, [prefillEmail, prefillName, prefillPlan, signupMode]);

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileResetKey((k) => k + 1);
  }

  function markLegalAccepted() {
    const acceptedAt = new Date().toISOString();
    setAgreeLegal(true);
    setLegalAcceptedAt(acceptedAt);
    setLegalModalOpen(false);
  }

  const checks = useMemo(() => passwordChecks(password), [password]);
  const pwOk = useMemo(() => Object.values(checks).every(Boolean), [checks]);
  const matchOk = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      if (!turnstileToken) throw new Error("Please complete the bot check.");
      if (!pwOk) throw new Error("Password does not meet the requirements below.");
      if (!matchOk) throw new Error("Passwords do not match.");
      if (!agreeLegal || !legalAcceptedAt) {
        throw new Error("You must review and accept the terms and agreements before creating your account.");
      }

      await track("signup_submit", {
        hasCompanyName: Boolean(companyName.trim()),
        signupMode: signupMode || "standard",
        agreedLegal: true,
      });

      const requestedPlanKey =
        signupMode === "tester"
          ? "starter_tester"
          : (prefillPlan || "free");

      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          turnstileToken,

          companyName: companyName.trim(),
          country: country || null,
          province: province || null,
          signupMode: signupMode || "standard",
          requestedPlanKey,

          termsAcceptedAt: legalAcceptedAt,
          privacyAcceptedAt: legalAcceptedAt,
          aiPolicyAcceptedAt: legalAcceptedAt,
          dpaAcknowledgedAt: legalAcceptedAt,

          termsVersion: LEGAL_TERMS_VERSION,
          privacyVersion: LEGAL_PRIVACY_VERSION,
          aiPolicyVersion: LEGAL_AI_POLICY_VERSION,
          dpaVersion: LEGAL_DPA_VERSION,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Signup failed.");

      setSent(true);
      await track("signup_success", {
        signupMode: signupMode || "standard",
        agreedLegal: true,
      });
    } catch (e: any) {
      const friendly = normalizeAuthMessage(e);
      const message = friendly || e?.message || "Signup failed.";
      setErr(message);
      await track("signup_error", { message });

      const msg = String(message).toLowerCase();
      const looksLikeBot =
        msg.includes("bot") ||
        msg.includes("turnstile") ||
        msg.includes("captcha") ||
        msg.includes("complete the check");

      if (looksLikeBot) resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-[#0C0B0A] text-[#E8E2D8]" style={{ paddingTop: "var(--early-access-banner-h)" }}>
        <SiteHeader rightLabel="Log in" rightHref="/login" />

        <div className="max-w-md mx-auto px-6 pt-24 pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-3 py-1 text-xs text-[#D4A853]">
            <span className="h-2 w-2 rounded-full bg-[#D4A853]" />
            {signupMode === "tester" ? "Starter tester account" : "Owner account"}
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[#E8E2D8]">
            {sent
              ? "Success!!"
              : signupMode === "tester"
                ? "Start your tester account"
                : "Create your account"}
          </h1>

          <p className="mt-2 text-[#A8A090]">
            {sent
              ? "Check your email to confirm your account and finish setup."
              : signupMode === "tester"
                ? "Create your tester account. You’ll confirm your email and start using ChiefOS in minutes."
                : "Add your company name and email, create a password, review the legal agreement, then submit."}
          </p>

          {sent ? (
            <div className="mt-8 rounded-2xl border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] p-4">
              <p className="font-medium text-[#E8E2D8]">Check your email</p>
              <p className="mt-2 text-sm text-[#A8A090]">
                We sent you a confirmation link. Click it to finish creating your account.
              </p>
              <p className="mt-4 text-sm text-[#A8A090]">
                Already confirmed?{" "}
                <a className="underline text-[#D4A853] hover:text-[#C49843]" href="/login">
                  Log in
                </a>
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#A8A090]">Company name</label>
                <input
                  id="companyName"
                  name="companyName"
                  className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Mission Exteriors (or your company)"
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A8A090]">Where are you based?</label>
                <div className="mt-1 flex gap-2">
                  {([
                    { code: "CA", flag: "🇨🇦", label: "Canada" },
                    { code: "US", flag: "🇺🇸", label: "United States" },
                  ] as const).map(({ code, flag, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { setCountry(code); setProvince(""); }}
                      className={[
                        "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
                        country === code
                          ? "border-[rgba(212,168,83,0.5)] bg-[rgba(212,168,83,0.15)] text-[#D4A853]"
                          : "border-[rgba(212,168,83,0.15)] bg-[#0F0E0C] text-[#A8A090] hover:border-[rgba(212,168,83,0.3)]",
                      ].join(" ")}
                    >
                      <span>{flag}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                {!country ? (
                  <p className="mt-1.5 text-xs text-[#706A60]">
                    This determines tax labels, mileage rates, and export formats for your accountant.
                  </p>
                ) : null}
              </div>

              {country === "CA" && (
                <div>
                  <label className="block text-sm font-medium text-[#A8A090]">Province</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)] text-sm"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="">— Select province —</option>
                    <option value="AB">Alberta</option>
                    <option value="BC">British Columbia</option>
                    <option value="MB">Manitoba</option>
                    <option value="NB">New Brunswick</option>
                    <option value="NL">Newfoundland and Labrador</option>
                    <option value="NS">Nova Scotia</option>
                    <option value="NT">Northwest Territories</option>
                    <option value="NU">Nunavut</option>
                    <option value="ON">Ontario</option>
                    <option value="PE">Prince Edward Island</option>
                    <option value="QC">Quebec</option>
                    <option value="SK">Saskatchewan</option>
                    <option value="YT">Yukon</option>
                  </select>
                </div>
              )}

              {country === "US" && (
                <div>
                  <label className="block text-sm font-medium text-[#A8A090]">State</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)] text-sm"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="">— Select state —</option>
                    <option value="AL">Alabama</option>
                    <option value="AK">Alaska</option>
                    <option value="AZ">Arizona</option>
                    <option value="AR">Arkansas</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="DE">Delaware</option>
                    <option value="FL">Florida</option>
                    <option value="GA">Georgia</option>
                    <option value="HI">Hawaii</option>
                    <option value="ID">Idaho</option>
                    <option value="IL">Illinois</option>
                    <option value="IN">Indiana</option>
                    <option value="IA">Iowa</option>
                    <option value="KS">Kansas</option>
                    <option value="KY">Kentucky</option>
                    <option value="LA">Louisiana</option>
                    <option value="ME">Maine</option>
                    <option value="MD">Maryland</option>
                    <option value="MA">Massachusetts</option>
                    <option value="MI">Michigan</option>
                    <option value="MN">Minnesota</option>
                    <option value="MS">Mississippi</option>
                    <option value="MO">Missouri</option>
                    <option value="MT">Montana</option>
                    <option value="NE">Nebraska</option>
                    <option value="NV">Nevada</option>
                    <option value="NH">New Hampshire</option>
                    <option value="NJ">New Jersey</option>
                    <option value="NM">New Mexico</option>
                    <option value="NY">New York</option>
                    <option value="NC">North Carolina</option>
                    <option value="ND">North Dakota</option>
                    <option value="OH">Ohio</option>
                    <option value="OK">Oklahoma</option>
                    <option value="OR">Oregon</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="RI">Rhode Island</option>
                    <option value="SC">South Carolina</option>
                    <option value="SD">South Dakota</option>
                    <option value="TN">Tennessee</option>
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="VT">Vermont</option>
                    <option value="VA">Virginia</option>
                    <option value="WA">Washington</option>
                    <option value="WV">West Virginia</option>
                    <option value="WI">Wisconsin</option>
                    <option value="WY">Wyoming</option>
                    <option value="DC">District of Columbia</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#A8A090]">Email</label>
                <input
                  id="email"
                  name="email"
                  className="mt-1 w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A8A090]">Password</label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    name="password"
                    className="w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 pr-11 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#706A60] hover:text-[#D4A853] transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeIcon off /> : <EyeIcon />}
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <CheckRow ok={checks.len} label="10+ characters" />
                  <CheckRow ok={checks.num} label="A number" />
                  <CheckRow ok={checks.upper} label="An uppercase" />
                  <CheckRow ok={checks.lower} label="A lowercase" />
                  <CheckRow ok={checks.sym} label="A symbol" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A8A090]">Confirm password</label>
                <div className="relative mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    className="w-full rounded-md border border-[rgba(212,168,83,0.2)] bg-[#0F0E0C] px-3 py-2 pr-11 text-[#E8E2D8] placeholder:text-[#706A60] outline-none focus:border-[rgba(212,168,83,0.5)] focus:ring-1 focus:ring-[rgba(212,168,83,0.2)]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#706A60] hover:text-[#D4A853] transition"
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirm ? <EyeIcon off /> : <EyeIcon />}
                  </button>
                </div>

                {confirmPassword.length > 0 && !matchOk ? (
                  <div className="mt-2 text-xs text-red-400">Passwords don’t match.</div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.05)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-[#E8E2D8]">Terms and Agreement Review</div>
                    <p className="mt-2 text-sm text-[#A8A090] leading-relaxed">
                      Review the Terms of Service, Privacy Policy, AI Usage Policy, and Data Processing Agreement in one place before creating your account.
                    </p>
                  </div>

                  {agreeLegal ? (
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                      Accepted
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setLegalModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-[2px] border border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] px-4 py-3 text-sm font-semibold text-[#D4A853] hover:bg-[rgba(212,168,83,0.15)] transition"
                  >
                    {agreeLegal ? "Review again" : "Review and accept"}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[#706A60]">
                  Acceptance is stored with your pending signup and finalized during secure workspace setup.
                </p>
              </div>

              <div className="pt-2">
                <TurnstileBox resetKey={turnstileResetKey} onToken={(t) => setTurnstileToken(t)} />
              </div>

              {err ? <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div> : null}

              <button
                className="w-full rounded-[2px] bg-[#D4A853] px-4 py-2 text-[#0C0B0A] font-semibold hover:bg-[#C49843] disabled:opacity-60 transition"
                disabled={loading || !turnstileToken || !agreeLegal}
                type="submit"
              >
                {loading ? "Sending link..." : "Sign up"}
              </button>

              <p className="text-sm text-[#A8A090]">
                Already have an account?{" "}
                <a className="underline text-[#D4A853] hover:text-[#C49843]" href="/login">
                  Log in
                </a>
              </p>
            </form>
          )}
        </div>
      </main>

      <LegalAgreementModal
        open={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        onAccept={markLegalAccepted}
        accepted={agreeLegal}
      />
    </>
  );
}