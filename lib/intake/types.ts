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

export type IntakeValidationFlag =
  | "missing_amount"
  | "missing_vendor"
  | "missing_date"
  | "multiple_totals_detected"
  | "subtotal_tax_total_mismatch"
  | "unsupported_currency"
  | "low_confidence_amount"
  | "low_confidence_vendor"
  | "possible_duplicate_attachment"
  | "possible_duplicate_content"
  | "job_unresolved"
  | "job_ambiguous"
  | "receipt_image_blurry"
  | "pdf_text_empty"
  | "voice_transcript_low_confidence"
  | "unsupported_file_type"
  | "ocr_pending";

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

export type IntakeCandidateFields = {
  amount_cents: number | null;
  currency: string | null;
  vendor: string | null;
  description: string | null;
  event_date: string | null;
  subtotal_cents?: number | null;
  tax_cents?: number | null;
  total_cents?: number | null;
  job_name?: string | null;
  expense_category?: string | null;
};

export type IntakePipelineNormalize = {
  kind: IntakeItemKind;
  draft_type: IntakeDraftType;
  mime_type: string | null;
  source_filename: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
};

export type IntakePipelineExtract = {
  source: "ocr_text" | "transcript_text" | "digital_text" | "none";
  text_present: boolean;
  text_preview?: string;
  candidate_fields: IntakeCandidateFields;
};

export type IntakePipelineValidate = {
  confidence_score: number;
  validation_flags: IntakeValidationFlag[];
  required_review: boolean;
};

export type IntakePipelineEnrich = {
  review_summary?: string;
  suggested_job_terms?: string[];
  explain_amount_source?: string;
  explain_vendor_source?: string;
  kind?: IntakeItemKind;
};

export type IntakePipelineOutput = {
  pipeline_version?: string;
  normalize?: IntakePipelineNormalize;
  extract?: IntakePipelineExtract;
  validate?: IntakePipelineValidate;
  enrich?: IntakePipelineEnrich;
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
  expense_category: string | null;
  is_personal: boolean;
  raw_model_output: IntakePipelineOutput | Record<string, unknown>;
  validation_flags: IntakeValidationFlag[];
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

export type IntakeJobSuggestion = {
  id: number;
  job_name: string;
  status?: string | null;
};

export type IntakeBatchProgress = {
  total: number;
  pending: number;
  persisted: number;
  skipped: number;
  duplicate: number;
  failed: number;
  currentIndex: number;
};

export type IntakeItemNav = {
  prevItemId: string | null;
  nextItemId: string | null;
  nextPendingItemId: string | null;
};

export type IntakeEvidenceView = {
  storage_bucket: string;
  storage_path: string;
  source_filename: string | null;
  mime_type: string | null;
  kind: IntakeItemKind;
};

export type IntakeItemDetailResponse = {
  ok: true;
  item: IntakeItemRow;
  draft: IntakeItemDraftRow | null;
  reviews: IntakeItemReviewRow[];
  batchProgress: IntakeBatchProgress;
  nav: IntakeItemNav;
  jobSuggestions: IntakeJobSuggestion[];
  evidence: IntakeEvidenceView;
  extractedText: {
    ocr_text: string | null;
    transcript_text: string | null;
    best_text: string | null;
  };
  parse: IntakePipelineOutput | null;
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