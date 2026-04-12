-- Add owner_name to chiefos_pending_signups
-- Nullable, non-breaking, idempotent
ALTER TABLE chiefos_pending_signups
  ADD COLUMN IF NOT EXISTS owner_name text;
