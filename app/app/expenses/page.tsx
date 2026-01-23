"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Expense = {
  id: string;
  amount: number;
  vendor: string | null;
  description: string | null;
  expense_date: string;
  job_name: string | null;
};

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 1) Ensure user is logged in
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        if (!auth.user) {
          router.push("/login");
          return;
        }

        // 2) Ensure portal user row exists + has tenant
        const { data: pu, error: puErr } = await supabase
          .from("chiefos_portal_users")
          .select("tenant_id")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (puErr) throw puErr;

        if (!pu?.tenant_id) {
          router.push("/finish-signup");
          return;
        }

        // 3) Ensure WhatsApp is linked for this tenant (NEW TABLE)
        const { data: mapRows, error: mapErr } = await supabase
          .from("chiefos_identity_map")
          .select("id")
          .eq("tenant_id", pu.tenant_id)
          .eq("kind", "whatsapp")
          .limit(1);

        if (mapErr) throw mapErr;

        if (!mapRows || mapRows.length === 0) {
          router.push("/app/connect-whatsapp");
          return;
        }

        // 4) Fetch expenses (RLS enforces tenant)
        const { data, error } = await supabase
          .from("chiefos_expenses")
          .select("*")
          .order("expense_date", { ascending: false });

        if (error) throw error;

        if (!cancelled) setExpenses((data ?? []) as Expense[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load expenses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function downloadCSV() {
    if (!expenses.length) return;

    const headers = ["Date", "Vendor", "Amount", "Job", "Description"];

    const rows = expenses.map((e) => [
      e.expense_date,
      e.vendor ?? "",
      e.amount,
      e.job_name ?? "",
      e.description ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="p-8 text-gray-600">Loading expenses…</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Expenses</h1>

          <div className="flex gap-2">
            <button
              onClick={downloadCSV}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Download CSV
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>

        {expenses.length === 0 ? (
          <p className="mt-12 text-gray-600">No expenses found.</p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b text-left text-sm text-gray-600">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b text-sm">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {e.expense_date}
                    </td>
                    <td className="py-2 pr-4">{e.vendor ?? "—"}</td>
                    <td className="py-2 pr-4">
                      ${Number(e.amount).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4">{e.job_name ?? "—"}</td>
                    <td className="py-2">{e.description ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
