-- ═══════════════════════════════════════════════════════════════════
-- RESOURCES v5 — run in Supabase SQL Editor
-- Adds last_review_date and last_increment_amount columns.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS last_review_date      DATE,
  ADD COLUMN IF NOT EXISTS last_increment_amount NUMERIC(18,2) DEFAULT 0;
