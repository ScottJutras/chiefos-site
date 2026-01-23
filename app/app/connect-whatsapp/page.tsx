"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type LinkCodeRow = {
  id: string;
  code: string;
  expires_at: string | null;
  used_at: string | null;
  created_at: string;
};

type PortalUserRow = {
  user_id: string;
  tenant_id: string | null;
  role: string | null;
  created_at: string | null;
};

function fmtTime(ts: string | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ConnectWhatsAppPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [codeRow, setCodeRow] = useState<LinkCodeRow | null>(null);

  // ✅ Your RPC name (confirmed)
  const LINK_CODE_RPC_NAME = "chiefos_create_link_code";
  const LINK_CODE_RPC_ARGS: Record<string, any> = {};

  // Polling control
  const pollRef = useRef<number | null>(null);

  async function requireAuth() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) {
      router.push("/login");
      return null;
    }
    return data.user;
  }

  async function getPortalUserRow(authUserId: string) {
    const { data, error } = await supabase
      .from("chiefos_portal_users")
      .select("user_id, tenant_id, role, created_at")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (error) throw error;
    return (data as PortalUserRow | null) ?? null;
  }

  // IMPORTANT:
  // chiefos_link_codes.portal_user_id is the auth user id in your current schema/data.
  async function fetchLatestUnexpiredUnusedCode(portalUserId: string) {
    const { data, error } = await supabase
      .from("chiefos_link_codes")
      .select("id, code, expires_at, used_at, created_at")
      .eq("portal_user_id", portalUserId)
      .is("used_at", null)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as LinkCodeRow | null) ?? null;
  }

  async function createNewCode() {
    setError(null);
    setCreating(true);

    try {
      const user = await requireAuth();
      if (!user) return;

      const pu = await getPortalUserRow(user.id);
      if (!pu?.tenant_id) {
        router.push("/finish-signup");
        return;
      }

      // 1) Create code via RPC (SECURITY DEFINER)
      const { error: rpcErr } = await supabase.rpc(LINK_CODE_RPC_NAME, LINK_CODE_RPC_ARGS);
      if (rpcErr) throw rpcErr;

      // 2) Fetch latest code for THIS user_id (portal_user_id == auth user id)
      const latest = await fetchLatestUnexpiredUnusedCode(user.id);
      setCodeRow(latest);

      if (!latest) {
        setError(
          `No link code found after RPC. That usually means the RPC wrote a code for a different portal_user_id, or RLS blocked the insert.`
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error creating link code.");
    } finally {
      setCreating(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const user = await requireAuth();
      if (!user) return;

      const pu = await getPortalUserRow(user.id);
      if (!pu?.tenant_id) {
        router.push("/finish-signup");
        return;
      }

      const latest = await fetchLatestUnexpiredUnusedCode(user.id);
      setCodeRow(latest);

      if (!latest) {
        await createNewCode();
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error loading connect page.");
    } finally {
      setLoading(false);
    }
  }

  async function checkLinked() {
    // NOTE: don't flip UI into "Checking..." during background polling
    try {
      const user = await requireAuth();
      if (!user) return;

      const pu = await getPortalUserRow(user.id);
      if (!pu?.tenant_id) {
        router.push("/finish-signup");
        return;
      }

      const { data, error } = await supabase
        .from("chiefos_identity_map")
        .select("id")
        .eq("tenant_id", pu.tenant_id)
        .eq("kind", "whatsapp")
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        router.push("/app/expenses");
        return;
      }
    } catch (e: any) {
      // For polling we keep errors quiet; button-driven check will show errors
    }
  }

  // Button-driven "I sent it" (shows status)
  async function checkLinkedWithUI() {
    setError(null);
    setChecking(true);
    try {
      await checkLinked();
      // If not linked yet, refresh code view (maybe still valid)
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Unknown error checking link status.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Auto-redirect polling: once a code is on screen, poll until mapping exists
  useEffect(() => {
    if (!codeRow?.code) return;

    // clear existing
    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(() => {
      checkLinked().catch(() => null);
    }, 1500);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeRow?.code]);

  if (loading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }

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

        <p className="mt-4 text-gray-600">
          This links your portal account to the phone number you use in WhatsApp so expenses flow in automatically.
        </p>

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">Error</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        <div className="mt-8 rounded-lg border p-5">
          <div className="text-sm font-semibold">Step 1</div>
          <div className="mt-2 text-gray-700 text-sm">
            Send this message to ChiefOS on WhatsApp:
          </div>

          <div className="mt-4 rounded-md bg-gray-50 border px-4 py-3 font-mono text-lg">
            {codeRow?.code ? `LINK ${codeRow.code}` : "No code available"}
          </div>

          {codeRow?.expires_at ? (
            <div className="mt-2 text-xs text-gray-500">Expires at {fmtTime(codeRow.expires_at)}.</div>
          ) : (
            <div className="mt-2 text-xs text-gray-500">Tip: the page will auto-redirect once linked.</div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={createNewCode}
              disabled={creating}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {creating ? "Generating…" : "Get a new code"}
            </button>

            <button
              onClick={checkLinkedWithUI}
              disabled={checking}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {checking ? "Checking Link…" : "I sent it"}
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            After you send it, you can just wait — this page will redirect automatically.
          </div>
        </div>
      </div>
    </main>
  );
}
