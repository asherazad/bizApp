-- ═══════════════════════════════════════════════════════════════════
-- RESOURCES v3 — run in Supabase SQL Editor AFTER v2
-- Fixes NOT NULL constraints on optional fields so import & manual
-- create work without requiring every original column.
-- ═══════════════════════════════════════════════════════════════════

-- ── Allow business_wing_id to be NULL (resource may not belong to a wing)
ALTER TABLE resources ALTER COLUMN business_wing_id DROP NOT NULL;

-- ── Allow join_date to be NULL (may not be known at import time)
ALTER TABLE resources ALTER COLUMN join_date DROP NOT NULL;

-- ── Set safe defaults on original NOT NULL columns so inserts don't fail
--    when only the new Excel columns are provided
ALTER TABLE resources
  ALTER COLUMN resource_type  SET DEFAULT 'employee',
  ALTER COLUMN status         SET DEFAULT 'active',
  ALTER COLUMN basic_salary   SET DEFAULT 0,
  ALTER COLUMN annual_leaves  SET DEFAULT 0;

-- ── Verify
-- SELECT column_name, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'resources'
--   ORDER BY ordinal_position;
