export type IntakeBatchKind =
  | "receipt_image_batch"
  | "voice_batch"
  | "pdf_batch"
  | "mixed_batch";

export type IntakeItemKind =
  | "receipt_image"
  | "voice_note"
  | "pdf_document"
  | "unknown";

export type IntakeItemStatus =
  | "uploaded"
  | "normalized"
  | "extracted"
  | "validated"
  | "pending_review"
  | "confirmed"
  | "persisted"
  | "skipped"
  | "duplicate"
  | "failed"
  | "quarantine";

export type IntakeDraftType =
  | "expense"
  | "time"
  | "task"
  | "revenue"
  | "unknown";

export type IntakeReviewAction =
  | "confirm"
  | "edit_confirm"
  | "skip"
  | "duplicate"
  | "reject";

export type IntakeBatchRow = {
  id: string;
  tenant_id: string;
  owner_id: string;
  created_by_auth_user_id: string;
  kind: IntakeBatchKind;
  status: "uploaded" | "processing" | "pending_review" | "completed" | "failed";
  total_items: number;
  confirmed_items: number;
  skipped_items: number;
  duplicate_items: number;
  created_at: string;
  updated_at: string;
};

export type IntakeItemRow = {
  id: string;
  batch_id: string;
  tenant_id: string;
  owner_id: string;
  created_by_auth_user_id: string;
  kind: IntakeItemKind;
  status: IntakeItemStatus;
  storage_bucket: string;
  storage_path: string;
  source_filename: string | null;
  mime_type: string | null;
  source_hash: string | null;
  ocr_text: string | null;
  transcript_text: string | null;
  draft_type: IntakeDraftType | null;
  confidence_score: number | null;
  duplicate_of_item_id: string | null;
  job_int_id: number | null;
  job_name: string | null;
  source_msg_id: string | null;
  dedupe_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type IntakeItemDraftRow = {
  id: string;
  intake_item_id: string;
  tenant_id: string;
  owner_id: string;
  draft_type: IntakeDraftType;
  amount_cents: number | null;
  currency: string | null;
  vendor: string | null;
  description: string | null;
  event_date: string | null;
  job_int_id: number | null;
  job_name: string | null;
  raw_model_output: Record<string, unknown>;
  validation_flags: string[];
  created_at: string;
  updated_at: string;
};

export type IntakeItemReviewRow = {
  id: string;
  intake_item_id: string;
  tenant_id: string;
  owner_id: string;
  reviewed_by_auth_user_id: string;
  action: IntakeReviewAction;
  before_payload: Record<string, unknown>;
  after_payload: Record<string, unknown>;
  comment: string | null;
  created_at: string;
};

export type IntakeListResponse = {
  ok: true;
  rows: IntakeItemRow[];
  nextCursor?: string | null;
};

export type IntakeBatchResponse = {
  ok: true;
  batch: IntakeBatchRow;
  items: IntakeItemRow[];
};

export type IntakeUploadResponse = {
  ok: true;
  batchId: string;
  uploadedCount: number;
  itemIds: string[];
};

export type IntakeErrorResponse = {
  ok: false;
  error: string;
  code?: string;
  hint?: string;
};