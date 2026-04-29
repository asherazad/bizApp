-- ═══════════════════════════════════════════════════════════════════
-- PAYROLL v2 — run in Supabase SQL Editor
-- Adds gross_salary column missing from the initial table creation.
-- Safe to run even if already applied (uses IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS gross_salary NUMERIC(18,2) NOT NULL DEFAULT 0;
