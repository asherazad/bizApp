-- ════════════════════════════════════════════════════════════════════════
-- ATTENDANCE v2 — Status migration
-- Run in Supabase SQL Editor OR trigger via POST /api/attendance/migrate-statuses
--
-- Old logic:  present | half_day | leave
-- New logic:  present | short_hours | half_day | absent
--
--   half_day WITH both check_in + check_out, hours ≥ 8 → present
--   half_day WITH both check_in + check_out, hours  < 8 → short_hours
--   half_day WITH check_in only (no check_out)           → half_day  (unchanged)
--   leave    WITH no check_in and no check_out            → absent
-- ════════════════════════════════════════════════════════════════════════

-- Step 1 — reclassify half_day records that have both times recorded
-- check_in/check_out are TIME columns; subtract to get an interval, then extract minutes
UPDATE attendance_records
SET status = CASE
  WHEN EXTRACT(EPOCH FROM (check_out - check_in)) / 60 >= 480 THEN 'present'
  ELSE 'short_hours'
END
WHERE status    = 'half_day'
  AND check_in  IS NOT NULL
  AND check_out IS NOT NULL;

-- Step 2 — auto-filled leave days (no punch) → absent
UPDATE attendance_records
SET status = 'absent'
WHERE status    = 'leave'
  AND check_in  IS NULL
  AND check_out IS NULL;
