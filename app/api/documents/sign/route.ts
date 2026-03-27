// app/api/documents/sign/route.ts
// Public endpoint — no auth required.
// Receives { token, signatureDataUrl }, validates the token, saves signature,
// clears the token (single-use), and notifies the tenant owner.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import postmark from "postmark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(n: string) {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var: ${n}`);
  return v;
}

function adminClient() {
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const { token, signatureDataUrl } = (await req.json()) as {
      token: string;
      signatureDataUrl: string;
    };

    if (!token || !signatureDataUrl) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const admin = adminClient();

    const { data: fileRec, error } = await admin
      .from("job_document_files")
      .select("id, job_id, kind, tenant_id, signed_at")
      .eq("signature_token", token)
      .maybeSingle();

    if (error || !fileRec) {
      return NextResponse.json({ error: "Invalid or expired signature link." }, { status: 404 });
    }
    if (fileRec.signed_at) {
      return NextResponse.json({ error: "Already signed." }, { status: 409 });
    }

    // Save signature, clear token
    await admin
      .from("job_document_files")
      .update({
        signed_at: new Date().toISOString(),
        signature_data: signatureDataUrl,
        signature_token: null,
      })
      .eq("id", fileRec.id);

    // Notify owner
    try {
      const serverToken = process.env.POSTMARK_SERVER_TOKEN;
      const from = process.env.POSTMARK_FROM;
      if (serverToken && from) {
        const pmClient = new postmark.ServerClient(serverToken);

        const { data: job } = await admin
          .from("jobs")
          .select("job_name, name")
          .eq("id", fileRec.job_id)
          .maybeSingle();
        const jobName = job?.job_name || job?.name || `Job #${fileRec.job_id}`;

        const { data: tenant } = await admin
          .from("chiefos_tenants")
          .select("owner_id")
          .eq("id", fileRec.tenant_id)
          .maybeSingle();

        let ownerEmail = from;
        if (tenant?.owner_id) {
          const { data: ownerUser } = await admin.auth.admin.getUserById(tenant.owner_id);
          if (ownerUser?.user?.email) ownerEmail = ownerUser.user.email;
        }

        const kindLabel =
          { quote: "Quote", contract: "Contract", change_order: "Change Order" }[
            fileRec.kind as string
          ] || fileRec.kind;

        await pmClient.sendEmail({
          From: from,
          To: ownerEmail,
          Subject: `✓ ${kindLabel} signed — ${jobName}`,
          HtmlBody: `<div style="font-family:ui-sans-serif;line-height:1.6"><h2>${kindLabel} Signed</h2><p>Your client has signed the ${kindLabel.toLowerCase()} for <strong>${jobName}</strong>.</p><p>Log in to ChiefOS to view the signed document.</p></div>`,
          TextBody: `${kindLabel} signed for ${jobName}. Log in to ChiefOS to view.`,
          MessageStream: "outbound",
        });
      }
    } catch (_) {
      // Don't fail the sign response if notification fails
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Sign failed" }, { status: 500 });
  }
}
