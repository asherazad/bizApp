-- ═══════════════════════════════════════════════════════════════════
-- LOANS v2 — run in Supabase SQL Editor
-- Adds business_wing_id column that was missing from the initial table.
-- Safe to run even if already applied (uses IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE loan_records
  ADD COLUMN IF NOT EXISTS business_wing_id UUID REFERENCES business_wings(id) ON DELETE SET NULL;
