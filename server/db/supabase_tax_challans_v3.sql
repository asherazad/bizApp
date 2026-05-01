-- ═══════════════════════════════════════════════════════════════════
-- TAX CHALLANS v3 — run in Supabase SQL Editor
-- Drops the status check constraint that rejects valid values
-- sent by the application (pending, paid, overdue, disputed).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE tax_challans DROP CONSTRAINT IF EXISTS tax_challans_status_check;
