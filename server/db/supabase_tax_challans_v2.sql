-- ═══════════════════════════════════════════════════════════════════
-- TAX CHALLANS v2 — run in Supabase SQL Editor
-- Drops the challan_type check constraint that rejects valid values
-- sent by the application (sales_tax, income_tax, etc.).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE tax_challans DROP CONSTRAINT IF EXISTS tax_challans_challan_type_check;
