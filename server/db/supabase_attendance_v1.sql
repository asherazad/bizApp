-- ═══════════════════════════════════════════════════════════════════
-- ATTENDANCE v1 — run in Supabase SQL Editor
-- Drops the check constraints on attendance_records that reject
-- lowercase status values (present, half_day, leave, absent, etc.)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_status_check;
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_leave_type_check;

-- Ensure a safe default so plain inserts never violate NOT NULL
ALTER TABLE attendance_records ALTER COLUMN status SET DEFAULT 'present';

-- Verify no check constraints remain
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM   pg_constraint
WHERE  conrelid = 'attendance_records'::regclass AND contype = 'c';
