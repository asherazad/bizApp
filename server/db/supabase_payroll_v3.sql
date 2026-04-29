-- ═══════════════════════════════════════════════════════════════════
-- PAYROLL v3 — run in Supabase SQL Editor
-- Makes business_wing_id nullable (resources can belong to any wing).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE payroll_runs
  ALTER COLUMN business_wing_id DROP NOT NULL;
