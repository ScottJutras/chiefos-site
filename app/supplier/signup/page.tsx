"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export default function SupplierSignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    companyName: "",
    supplierType: "manufacturer",
    region: "canada",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    companyAddress: "",
    description: "",
    password: "",
    confirmPassword: "",
  });

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (form.password !== form.confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/supplier/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          supplierType: form.supplierType,
          region: form.region,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          companyAddress: form.companyAddress,
          description: form.description,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || data.message || "Signup failed.");
      }

      router.push("/supplier/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
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
          {/* Company */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Company</h2>

            <Field label="Company name" required>
              <input
                type="text"
                required
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                className={inputCls}
                placeholder="Acme Supply Co."
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier type" required>
                <select
                  value={form.supplierType}
                  onChange={(e) => set("supplierType", e.target.value)}
                  className={inputCls}
                >
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Region" required>
                <select
                  value={form.region}
                  onChange={(e) => set("region", e.target.value)}
                  className={inputCls}
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Company address">
              <input
                type="text"
                value={form.companyAddress}
                onChange={(e) => set("companyAddress", e.target.value)}
                className={inputCls}
                placeholder="123 Main St, Toronto, ON"
              />
            </Field>

            <Field label="Brief product description">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={inputCls + " resize-none"}
                placeholder="What types of products do you supply?"
              />
            </Field>
          </section>

          {/* Contact */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Primary contact</h2>

            <Field label="Full name" required>
              <input
                type="text"
                required
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                className={inputCls}
                placeholder="Jane Smith"
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                required
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                className={inputCls}
                placeholder="jane@acmesupply.com"
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                className={inputCls}
                placeholder="+1 416 555 0100"
              />
            </Field>
          </section>

          {/* Password */}
          <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Account password</h2>

            <Field label="Password" required>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className={inputCls}
                autoComplete="new-password"
                minLength={8}
              />
            </Field>

            <Field label="Confirm password" required>
              <input
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
          </section>

          {err && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
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

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white/70">
        {label}
        {required && <span className="ml-0.5 text-white/40">*</span>}
      </label>
      {children}
    </div>
  );
}
