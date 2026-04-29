-- ═══════════════════════════════════════════════════════════════════
-- BANK TRANSACTIONS v1 — run in Supabase SQL Editor
-- Drops the reference_type check constraint that blocks 'payroll'
-- and 'transfer' values inserted by the application.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_reference_type_check;
