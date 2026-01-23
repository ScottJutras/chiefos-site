"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type LinkCodeRow = {
  code: string;
  expires_at: string;
};

export default function ConnectWhatsAppPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ensureLoggedIn() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/login");
      return null;
    }
    return data.user;
  }

  async function createCode() {
    setErr(null);
    setStatus("Generating your link code…");

    const { data, error } = await supabase.rpc("chiefos_create_link_code");

    if (error) {
      setErr(error.message);
      return;
    }

    // Supabase RPC returning a table often comes back as array
    const row = Array.isArray(data) ? (data[0] as LinkCodeRow) : (data as LinkCodeRow);

    setCode(row.code);
    setExpiresAt(row.expires_at);
    setStatus("Send this code to ChiefOS on WhatsApp.");
  }

  async function checkLinked() {
    setErr(null);
    setStatus("Checking link status…");

    // We check if your tenant has any WhatsApp mapping
    const { data: me } = await supabase.auth.getUser();
    const user = me.user;
    if (!user) {
      router.replace("/login");
      return;
    }

    // Get your tenant id
    const { data: pu, error: puErr } = await supabase
      .from("chiefos_portal_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (puErr) {
      setErr(puErr.message);
      return;
    }

    if (!pu?.tenant_id) {
      router.replace("/finish-signup");
      return;
    }

    // IMPORTANT: adjust table name below if yours differs
    const { data: mapping, error: mapErr } = await supabase
      .from("chiefos_identity_map")
      .select("id, whatsapp_owner_id")
      .eq("tenant_id", pu.tenant_id)
      .limit(1);

    if (mapErr) {
      setErr(mapErr.message);
      return;
    }

    if (mapping && mapping.length > 0) {
      router.replace("/app/expenses");
      return;
    }

    setStatus("Not linked yet. Send the WhatsApp message, then tap “I sent it”.");
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const user = await ensureLoggedIn();
      if (!user) return;

      await createCode();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayExpiry = expiresAt
    ? new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Connect WhatsApp</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Log out
          </button>
        </div>

        <p className="mt-3 text-gray-600">
          This links your portal account to the phone number you use in WhatsApp so expenses flow in automatically.
        </p>

        {loading ? (
          <div className="mt-10 text-gray-600">Loading…</div>
        ) : (
          <div className="mt-10 rounded-xl border p-6">
            {err && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <div className="text-sm text-gray-600">Step 1</div>
            <div className="mt-1 font-medium">Send this message to ChiefOS on WhatsApp:</div>

            <div className="mt-4 rounded-lg bg-gray-50 border px-4 py-3 font-mono text-lg">
              LINK {code ?? "------"}
            </div>

            {displayExpiry && (
              <div className="mt-2 text-sm text-gray-600">Expires at {displayExpiry}.</div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={createCode}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Get a new code
              </button>

              <button
                onClick={checkLinked}
                className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
              >
                I sent it
              </button>
            </div>

            {status && <div className="mt-4 text-sm text-gray-600">{status}</div>}
          </div>
        )}
      </div>
    </main>
  );
}
