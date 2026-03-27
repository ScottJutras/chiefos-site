// app/api/documents/upload/route.ts
// Accepts a base64 PDF from the client, uploads to Supabase Storage,
// inserts a job_document_files record, returns { fileId }.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(req: Request) {
  try {
    const token = bearerFromReq(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();
    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { data: pu } = await admin
      .from("chiefos_portal_users")
      .select("tenant_id")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pu?.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 });
    const tenantId = String(pu.tenant_id);

    const body = await req.json();
    const { jobId, kind, label, pdfBase64, filename } = body as {
      jobId: number;
      kind: string;
      label?: string;
      pdfBase64: string;
      filename?: string;
    };

    if (!jobId || !kind || !pdfBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const buffer = Buffer.from(pdfBase64, "base64");
    const bucket = "intake-uploads";
    const safeName = (filename || `${kind}-${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `documents/${tenantId}/${jobId}/${kind}/${safeName}`;

    const { error: uploadErr } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: fileRec, error: dbErr } = await admin
      .from("job_document_files")
      .insert({
        job_id: jobId,
        tenant_id: tenantId,
        kind,
        label: label || null,
        storage_bucket: bucket,
        storage_path: path,
      })
      .select("id")
      .single();

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, fileId: fileRec.id, storagePath: path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
  }
}
