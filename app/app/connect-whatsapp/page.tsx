"use client";
import { useTenantGate } from "@/lib/useTenantGate";
import { useEffect, useMemo, useState } from "react";
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

function digitsOnly(code: string | null | undefined) {
  return String(code || "").replace(/\D/g, "");
}

export default function ConnectWhatsAppPage() {
  const router = useRouter();

  // 1) Gate (auth + tenant)
  const { loading: gateLoading, userId, tenantId } = useTenantGate({ requireWhatsApp: false });

  // 2) Page state (only for link-code operations)
  const [pageLoading, setPageLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [codeRow, setCodeRow] = useState<LinkCodeRow | null>(null);
  const [copied, setCopied] = useState(false);
 
  useEffect(() => {
    document.title = "Connect WhatsApp · ChiefOS";
  }, []);

  if (gateLoading) {
    return <div className="p-8 text-gray-600">Loading…</div>;
  }


  // ✅ Your RPC name (confirmed)
  const LINK_CODE_RPC_NAME = "chiefos_create_link_code";
  const LINK_CODE_RPC_ARGS: Record<string, any> = {};

  const codeDigits = useMemo(() => digitsOnly(codeRow?.code), [codeRow?.code]);
  const has6Digits = codeDigits.length === 6;

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
  // chiefos_link_codes.portal_user_id == auth user id in your schema/data.
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
    setCopied(false);

    try {
     if (!userId || !tenantId) return; // gate should guarantee these, but stay safe


      // 1) Create code via RPC (SECURITY DEFINER)
      const { error: rpcErr } = await supabase.rpc(LINK_CODE_RPC_NAME, LINK_CODE_RPC_ARGS);
      if (rpcErr) throw rpcErr;

      // 2) Fetch latest code for THIS user_id (portal_user_id == auth user id)
      const latest = await fetchLatestUnexpiredUnusedCode(userId);
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
    setPageLoading(true);
    setError(null);
    setCopied(false);

try {
  if (!userId || !tenantId) return;

  const latest = await fetchLatestUnexpiredUnusedCode(userId);

      setCodeRow(latest);

      if (!latest) {
        await createNewCode();
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error loading connect page.");
    } finally {
      setPageLoading(false);
    }
  }

  async function checkLinked() {
    setError(null);
    setChecking(true);

    try {
      if (!userId || !tenantId) return;

      const { data, error } = await supabase
        .from("chiefos_identity_map")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "whatsapp")
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        router.push("/app/expenses");
        return;
      }

      // Not linked yet — refresh code display (may still be valid)
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

  // ✅ auto-check every 1.5s once we have a code
  useEffect(() => {
    if (!codeRow?.code) return;

    const t = setInterval(() => {
      checkLinked().catch(() => null);
    }, 1500);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeRow?.code]);

  // Reset "Copied!" after a moment
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  if (pageLoading) {
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
            Send <span className="font-semibold">only this 6-digit code</span> to ChiefOS on WhatsApp:
          </div>

          <div className="mt-4 rounded-md bg-gray-50 border px-4 py-3 font-mono text-2xl tracking-widest text-center">
            {has6Digits ? codeDigits : "No code available"}
          </div>

          {codeRow?.expires_at ? (
            <div className="mt-2 text-xs text-gray-500">Expires at {fmtTime(codeRow.expires_at)}.</div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={createNewCode}
              disabled={creating}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {creating ? "Generating…" : "Get a new code"}
            </button>

            <button
              onClick={checkLinked}
              disabled={checking}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check now"}
            </button>

            <button
              onClick={async () => {
                if (!has6Digits) return;
                try {
                  await navigator.clipboard.writeText(codeDigits);
                  setCopied(true);
                } catch {
                  // ignore
                }
              }}
              disabled={!has6Digits}
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy code"}
            </button>

            <a
              href={has6Digits ? `https://wa.me/?text=${encodeURIComponent(codeDigits)}` : undefined}
              className={`rounded-md border px-4 py-2 text-sm hover:bg-gray-50 inline-flex items-center ${
                !has6Digits ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Open WhatsApp
            </a>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Once you send the code, this page will auto-detect the link and take you to Expenses.
          </div>
        </div>
      </div>
    </main>
  );
}
