-- ═══════════════════════════════════════════════════════════════════
-- TAX CHALLANS v4 — run in Supabase SQL Editor
-- Migrates legacy column data to current column names.
-- Safe to run multiple times (WHERE NULL guard).
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Copy tax_amount → amount_due for records saved with old backend
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_challans' AND column_name = 'tax_amount'
  ) THEN
    UPDATE tax_challans
    SET amount_due = tax_amount
    WHERE amount_due IS NULL AND tax_amount IS NOT NULL;
  END IF;

  -- Copy tax_type → challan_type for records saved with old backend
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tax_challans' AND column_name = 'tax_type'
  ) THEN
    UPDATE tax_challans
    SET challan_type = tax_type
    WHERE challan_type IS NULL AND tax_type IS NOT NULL;
  END IF;
END $$;
