// app/api/documents/send/route.ts
// Sends a document to a client via email (Postmark).
// If needsSignature=true, creates a signature_token and sends a sign link.
// Otherwise generates a 7-day signed URL and emails the PDF directly.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import postmark from "postmark";
import { randomUUID } from "crypto";

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

function bearerFromReq(req: Request) {
  const raw = req.headers.get("authorization") || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}

const KIND_LABEL: Record<string, string> = {
  quote: "Quote",
  contract: "Contract",
  change_order: "Change Order",
  invoice: "Invoice",
  receipt: "Receipt",
};

export async function POST(req: Request) {
  try {
    const token = bearerFromReq(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();
    const { data: authData } = await admin.auth.getUser(token);
    if (!authData?.user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { fileId, to, kind, jobName, clientName, needsSignature } = (await req.json()) as {
      fileId: string;
      to: string;
      kind: string;
      jobName: string;
      clientName?: string;
      needsSignature?: boolean;
    };

    if (!fileId || !to || !kind) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const { data: fileRec } = await admin
      .from("job_document_files")
      .select("id, storage_bucket, storage_path")
      .eq("id", fileId)
      .single();
    if (!fileRec) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const serverToken = mustEnv("POSTMARK_SERVER_TOKEN");
    const from = mustEnv("POSTMARK_FROM");
    const pmClient = new postmark.ServerClient(serverToken);
    const appBase = (process.env.NEXT_PUBLIC_APP_BASE_URL || "https://usechiefos.com").replace(/\/$/, "");

    let docUrl: string;

    if (needsSignature) {
      const sigToken = randomUUID();
      await admin
        .from("job_document_files")
        .update({ signature_token: sigToken, sent_at: new Date().toISOString(), sent_via: "email" })
        .eq("id", fileId);
      docUrl = `${appBase}/sign/${sigToken}`;
    } else {
      const { data: signed } = await admin.storage
        .from(fileRec.storage_bucket)
        .createSignedUrl(fileRec.storage_path, 60 * 60 * 24 * 7);
      docUrl = signed?.signedUrl || "";
      await admin
        .from("job_document_files")
        .update({ sent_at: new Date().toISOString(), sent_via: "email" })
        .eq("id", fileId);
    }

    const kindLabel = KIND_LABEL[kind] || kind;
    const greeting = clientName ? `Hi ${clientName},` : "Hi there,";
    const action = needsSignature
      ? `Please review and sign your ${kindLabel.toLowerCase()} for <strong>${jobName}</strong>.`
      : `Please find your ${kindLabel.toLowerCase()} for <strong>${jobName}</strong> below.`;
    const btnLabel = needsSignature ? `Review & Sign ${kindLabel}` : `View ${kindLabel}`;
    const expNote = needsSignature
      ? "This signature link is single-use and expires after signing."
      : "This link expires in 7 days.";

    await pmClient.sendEmail({
      From: from,
      To: to,
      Subject: `${kindLabel} — ${jobName}`,
      HtmlBody: `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:24px 0">
          <h2 style="margin:0 0 16px;font-size:20px">${kindLabel}: ${jobName}</h2>
          <p style="margin:0 0 8px">${greeting}</p>
          <p style="margin:0 0 16px">${action}</p>
          <a href="${docUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px">${btnLabel}</a>
          <p style="margin:20px 0 0;font-size:12px;color:#999">${expNote}</p>
        </div>`,
      TextBody: `${kindLabel}: ${jobName}\n\n${greeting}\n\n${action.replace(/<[^>]+>/g, "")}\n\nLink: ${docUrl}\n\n${expNote}`,
      MessageStream: "outbound",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Send failed" }, { status: 500 });
  }
}
