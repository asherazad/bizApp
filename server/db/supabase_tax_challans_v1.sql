-- ═══════════════════════════════════════════════════════════════════
-- TAX CHALLANS v1 — run in Supabase SQL Editor
-- Adds missing columns and bank payment support to tax_challans.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE tax_challans
  ADD COLUMN IF NOT EXISTS taxable_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty         NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_date       DATE,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
