// app/sign/[token]/page.tsx
// Public e-signature page — no authentication required.
// Validates the token, shows the document for review, renders the signature canvas.
import { createClient } from "@supabase/supabase-js";
import SignClient from "./SignClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = adminClient();

  const { data: fileRec } = await admin
    .from("job_document_files")
    .select("id, job_id, kind, label, signed_at, storage_bucket, storage_path")
    .eq("signature_token", token)
    .maybeSingle();

  // Already signed
  if (fileRec?.signed_at) {
    return (
      <div className="min-h-screen bg-[#0C0B0A] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4 text-[#D4A853]">✓</div>
          <h1 className="text-2xl font-semibold text-[#E8E2D8] mb-2">Already signed</h1>
          <p className="text-[#A8A090] text-sm">
            This document has already been signed. Thank you.
          </p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!fileRec) {
    return (
      <div className="min-h-screen bg-[#0C0B0A] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold text-[#E8E2D8] mb-2">Link not found</h1>
          <p className="text-[#A8A090] text-sm">
            This signature link is invalid or has already been used. Contact your contractor for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Get PDF signed URL (1 hour)
  const { data: signed } = await admin.storage
    .from(fileRec.storage_bucket)
    .createSignedUrl(fileRec.storage_path, 60 * 60);

  // Get job name
  const { data: job } = await admin
    .from("jobs")
    .select("job_name, name, job_no")
    .eq("id", fileRec.job_id)
    .maybeSingle();
  const jobName = job?.job_name || job?.name || `Job #${fileRec.job_id}`;

  return (
    <SignClient
      token={token}
      fileId={fileRec.id}
      kind={fileRec.kind}
      label={fileRec.label}
      pdfUrl={signed?.signedUrl || null}
      jobName={jobName}
    />
  );
}
