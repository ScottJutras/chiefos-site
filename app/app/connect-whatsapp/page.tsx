"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type LinkCodeRow = {
  code: string;
  expires_at: string | null;
};

export default function ConnectWhatsAppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [codeRow, setCodeRow] = useState<LinkCodeRow | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  async function loadOrCreateCode() {
    setLoading(true);
    setStatus(null);

    // 1) Ensure logged in
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    // 2) Get portal user tenant
    const { data: pu, error: puErr } = await supabase
      .from("chiefos_portal_users")
      .select("id, tenant_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (puErr) {
      setStatus(`Portal user error: ${puErr.message}`);
      setLoading(false);
      return;
    }

    if (!pu?.tenant_id) {
      router.push("/finish-signup");
      return;
    }

    setTenantId(pu.tenant_id);

    // 3) If already linked, go to expenses
    const { data: mapRows, error: mapErr } = await supabase
      .from("chiefos_identity_map")
      .select("id")
      .eq("tenant_id", pu.tenant_id)
      .eq("kind", "whatsapp")
      .limit(1);

    if (mapErr) {
      setStatus(`Identity map error: ${mapErr.message}`);
      setLoading(false);
      return;
    }

    if (mapRows && mapRows.length > 0) {
      router.push("/app/expenses");
      return;
    }

    // 4) Create a link code (RPC you already installed in Step 1A)
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "chiefos_create_link_code",
      { p_tenant_id: pu.tenant_id }
    );

    if (rpcErr) {
      setStatus(`Link code error: ${rpcErr.message}`);
      setLoading(false);
      return;
    }

    // Expecting RPC to return { code, expires_at }
    setCodeRow(rpcData as LinkCodeRow);
    setLoading(false);
  }

  async function checkLinked() {
    setStatus("Checking link…");
    if (!tenantId) return;

    const { data: mapRows, error: mapErr } = await supabase
      .from("chiefos_identity_map")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "whatsapp")
      .limit(1);

    if (mapErr) {
      setStatus(`Identity map error: ${mapErr.message}`);
      return;
    }

    if (mapRows && mapRows.length > 0) {
      router.push("/app/expenses");
      return;
    }

    setStatus("Not linked yet. Send the LINK code in WhatsApp, then tap “I sent it” again.");
  }

  useEffect(() => {
    loadOrCreateCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiresText = codeRow?.expires_at
    ? new Date(codeRow.expires_at).toLocaleString()
    : null;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Connect WhatsApp</h1>
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

        <p className="mt-4 text-gray-700">
          This links your portal account to the phone number you use in WhatsApp so expenses flow in automatically.
        </p>

        {loading ? (
          <p className="mt-6 text-gray-600">Loading…</p>
        ) : (
          <>
            {status ? <p className="mt-6 text-sm text-gray-700">{status}</p> : null}

            <div className="mt-8 rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Step 1</h2>
              <p className="mt-2 text-gray-700">
                Send this message to ChiefOS on WhatsApp:
              </p>

              <div className="mt-3 flex items-center justify-between rounded-md bg-gray-50 px-4 py-3 font-mono">
                <span>LINK {codeRow?.code ?? "------"}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(`LINK ${codeRow?.code ?? ""}`);
                    setStatus("Copied.");
                  }}
                  className="rounded-md border bg-white px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Copy
                </button>
              </div>

              {expiresText ? (
                <p className="mt-2 text-sm text-gray-600">
                  Expires at {expiresText}.
                </p>
              ) : null}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={checkLinked}
                  className="rounded-md bg-black px-4 py-2 text-sm text-white hover:opacity-90"
                >
                  I sent it
                </button>

                <button
                  onClick={loadOrCreateCode}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Get a new code
                </button>
              </div>

              <p className="mt-4 text-sm text-gray-600">
                After you send the code in WhatsApp, tap “I sent it”.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
