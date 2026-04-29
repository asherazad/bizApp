-- ═══════════════════════════════════════════════════════════════════
-- RESOURCES v4 — run in Supabase SQL Editor
-- Drops the check constraint on resource_type that rejects 'employee',
-- and ensures the column default and status default are consistent.
-- ═══════════════════════════════════════════════════════════════════

-- Drop the blocking check constraint
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_resource_type_check;

-- Also drop any check on status in case it rejects 'active'
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_status_check;

-- Ensure defaults are set so plain inserts never violate NOT NULL
ALTER TABLE resources
  ALTER COLUMN resource_type SET DEFAULT 'employee',
  ALTER COLUMN status        SET DEFAULT 'active';

-- Verify no check constraints remain on this table
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'resources'::regclass AND contype = 'c';
