-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Invoice Wing Assignment + File Storage
-- Run this in Supabase → SQL Editor (safe to run multiple times — all idempotent)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1: Add wing_assignment_mode to invoices ──────────────────────────────
--
-- Tracks which of the three allocation modes was used:
--   'single'    → whole invoice belongs to one wing (business_wing_id)
--   'split'     → invoice total divided across wings by % (invoice_wing_splits rows)
--   'line_item' → each line item assigned to a wing; splits are aggregated totals
--
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS wing_assignment_mode TEXT NOT NULL DEFAULT 'single'
    CHECK (wing_assignment_mode IN ('single', 'split', 'line_item'));

-- ── STEP 2: Add file storage metadata columns to invoices ─────────────────────
--
-- source_file_path is the private Supabase Storage path (never sent to client).
-- The signed URL endpoint reads this and returns a 3600-second signed URL instead.
--
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_file_path        TEXT,
  ADD COLUMN IF NOT EXISTS source_file_name        TEXT,
  ADD COLUMN IF NOT EXISTS source_file_size        INTEGER,
  ADD COLUMN IF NOT EXISTS source_file_type        TEXT,
  ADD COLUMN IF NOT EXISTS source_file_uploaded_at TIMESTAMPTZ;

-- ── STEP 3: Create invoice_wing_splits ────────────────────────────────────────
--
-- One row per wing per invoice for 'split' and 'line_item' modes.
--
-- split_amount:
--   For 'split' mode  → amount entered directly by the user.
--   For 'line_item' mode → sum of line item amounts for this wing
--                          + proportional share of invoice tax_amount.
--                          This ensures SUM(split_amount) = invoices.total_amount exactly.
--
-- split_percentage:
--   = split_amount / total_amount * 100.
--   Stored to 4 decimal places; SUM across all rows for one invoice = 100.0000.
--
-- pkr_equivalent:
--   = split_amount when currency = 'PKR'.
--   = split_amount * exchange_rate otherwise.
--
CREATE TABLE IF NOT EXISTS invoice_wing_splits (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID        NOT NULL REFERENCES invoices(id)        ON DELETE CASCADE,
  business_wing_id  UUID        NOT NULL REFERENCES business_wings(id)  ON DELETE RESTRICT,
  split_amount      NUMERIC(18,2) NOT NULL,
  split_percentage  NUMERIC(8,4)  NOT NULL,
  pkr_equivalent    NUMERIC(18,2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- An invoice may not have two rows for the same wing
  CONSTRAINT uq_invoice_wing UNIQUE (invoice_id, business_wing_id)
);

-- ── STEP 4: Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoice_wing_splits_invoice_id
  ON invoice_wing_splits (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_wing_splits_wing_id
  ON invoice_wing_splits (business_wing_id);

-- Invoices table — search + filter indexes
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_name ON invoices (vendor_name);
CREATE INDEX IF NOT EXISTS idx_invoices_client_name ON invoices (client_name);
CREATE INDEX IF NOT EXISTS idx_invoices_po_id       ON invoices (po_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_wing_mode   ON invoices (wing_assignment_mode);

-- ── STEP 5: Verify ────────────────────────────────────────────────────────────
--
-- Run these SELECTs after the migration to confirm structure is correct.
-- All should return rows (no errors).
--
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'invoices'
--    AND column_name IN ('wing_assignment_mode','source_file_path','source_file_name','source_file_size','source_file_type','source_file_uploaded_at')
--  ORDER BY column_name;
--
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_name = 'invoice_wing_splits'
--  ORDER BY ordinal_position;
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename IN ('invoices','invoice_wing_splits')
--  ORDER BY tablename, indexname;
