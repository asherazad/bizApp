-- ═══════════════════════════════════════════════════════════════════
-- PAYROLL v4 — run in Supabase SQL Editor
-- Drops the status check constraint that rejects valid status values.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_status_check;
