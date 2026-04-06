"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TurnstileBox from "@/app/components/TurnstileBox";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPLIER_TYPES = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "distributor", label: "Distributor" },
  { value: "dealer", label: "Dealer" },
  { value: "specialty", label: "Specialty" },
];

const REGIONS = [
  { value: "canada", label: "Canada" },
  { value: "us", label: "United States" },
  { value: "both", label: "Canada + US" },
];

// ─── Password helpers ─────────────────────────────────────────────────────────

function passwordChecks(pw: string) {
  const s = pw || "";
  return {
    len:   s.length >= 10,
    upper: /[A-Z]/.test(s),
    lower: /[a-z]/.test(s),
    num:   /\d/.test(s),
    sym:   /[^A-Za-z0-9]/.test(s),
  };
}

function CheckDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-white/20"}`} />
      <span className={ok ? "text-white/70" : "text-white/30"}>{label}</span>
    </div>
  );
}

// ─── Eye icon ─────────────────────────────────────────────────────────────────

function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
      <path d="M9.88 5.47A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-4.27 5.01" />
      <path d="M6.61 6.61A17.4 17.4 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4.12-.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20";

const selectCls =
  "w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 appearance-none";

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white/70">
        {label}{required && <span className="ml-0.5 text-white/30">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── SelectWrapper: adds visible dropdown chevron ─────────────────────────────

function SelectField({ label, required, value, onChange, children }: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label} required={required}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectCls}
          style={{ colorScheme: "dark" }}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4l4 4 4-4" />
        </svg>
      </div>
    </Field>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierSignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    companyName: "",
    supplierType: "manufacturer",
    region: "canada",
    city: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    companyAddress: "",
    description: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [turnstileToken, setTurnstileToken]   = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [err, setErr]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const checks  = useMemo(() => passwordChecks(form.password), [form.password]);
  const pwOk    = useMemo(() => Object.values(checks).every(Boolean), [checks]);
  const matchOk = useMemo(
    () => form.password.length > 0 && form.password === form.confirmPassword,
    [form.password, form.confirmPassword]
  );

  function resetTurnstile() {
    setTurnstileToken(null);
    setTurnstileResetKey((k) => k + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!turnstileToken) { setErr("Please complete the bot check."); return; }
    if (!pwOk)           { setErr("Password does not meet all requirements."); return; }
    if (!matchOk)        { setErr("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/supplier/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:    form.companyName,
          supplierType:   form.supplierType,
          region:         form.region,
          companyCity:    form.city,
          contactName:    form.contactName,
          contactEmail:   form.contactEmail,
          contactPhone:   form.contactPhone,
          companyAddress: form.companyAddress,
          description:    form.description,
          password:       form.password,
          turnstileToken,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || data.message || "Signup failed.");

      router.push("/supplier/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <p className="text-sm font-medium text-white/50">ChiefOS Supplier Portal</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Apply to join</h1>
          <p className="mt-1 text-sm text-white/50">
            Submit your details — ChiefOS will review and approve your account.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">

          {/* ── Company ── */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">Company</h2>

            <Field label="Company name" required>
              <input
                type="text" required value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                className={inputCls} placeholder="Acme Supply Co."
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Supplier type" required
                value={form.supplierType}
                onChange={(v) => set("supplierType", v)}
              >
                {SUPPLIER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </SelectField>

              <SelectField
                label="Region served" required
                value={form.region}
                onChange={(v) => set("region", v)}
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </SelectField>
            </div>

            <Field label="City" required>
              <input
                type="text" required value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputCls} placeholder="Toronto"
              />
            </Field>

            <Field label="Street address">
              <input
                type="text" value={form.companyAddress}
                onChange={(e) => set("companyAddress", e.target.value)}
                className={inputCls} placeholder="123 Main St, Toronto, ON M5V 1A1"
              />
            </Field>

            <Field label="Brief product description">
              <textarea
                rows={3} value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={inputCls + " resize-none"}
                placeholder="What types of products do you supply?"
              />
            </Field>
          </section>

          {/* ── Primary contact ── */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">Primary contact</h2>

            <Field label="Full name" required>
              <input
                type="text" required value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                className={inputCls} placeholder="Jane Smith"
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email" required value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                className={inputCls} placeholder="jane@acmesupply.com"
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel" value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                className={inputCls} placeholder="+1 416 555 0100"
              />
            </Field>
          </section>

          {/* ── Password ── */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">Account password</h2>

            <Field label="Password" required>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className={inputCls + " pr-10"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>

              {/* Strength checklist */}
              {form.password.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <CheckDot ok={checks.len}   label="10+ characters" />
                  <CheckDot ok={checks.num}   label="A number" />
                  <CheckDot ok={checks.upper} label="An uppercase letter" />
                  <CheckDot ok={checks.lower} label="A lowercase letter" />
                  <CheckDot ok={checks.sym}   label="A symbol" />
                </div>
              )}
            </Field>

            <Field label="Confirm password" required>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  className={inputCls + " pr-10"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <EyeIcon off={showConfirm} />
                </button>
              </div>

              {/* Match indicator */}
              {form.confirmPassword.length > 0 && (
                matchOk ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Passwords match
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-red-400">Passwords don&apos;t match.</p>
                )
              )}
            </Field>
          </section>

          {/* ── Turnstile ── */}
          <div className="pt-1">
            <TurnstileBox resetKey={turnstileResetKey} onToken={(t) => setTurnstileToken(t)} />
          </div>

          {err && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
          >
            {loading ? "Submitting..." : "Submit application"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-white/40">
          Already have an account?{" "}
          <Link href="/supplier/login" className="text-white/70 underline hover:text-white">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
