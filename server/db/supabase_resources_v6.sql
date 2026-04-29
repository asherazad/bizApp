-- ═══════════════════════════════════════════════════════════════════
-- RESOURCES v6 — run in Supabase SQL Editor
-- Adds allowance_amount column for fixed monthly allowances that are
-- added on top of gross salary in payroll calculations.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS allowance_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
