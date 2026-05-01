-- ═══════════════════════════════════════════════════════════════════
-- CREDIT CARD TRANSACTIONS v1 — run in Supabase SQL Editor
-- Creates the credit_card_txns table for tracking CC spend by wing.
-- Also requires a Supabase Storage bucket named "cc-invoices"
-- (Dashboard → Storage → New bucket → cc-invoices, set to public).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credit_card_txns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date          DATE        NOT NULL,
  merchant          VARCHAR(255) NOT NULL,
  description       TEXT,
  amount            NUMERIC(18,2) NOT NULL,
  currency          VARCHAR(10)  NOT NULL DEFAULT 'PKR',
  category          VARCHAR(50),
  business_wing_id  UUID        REFERENCES business_wings(id) ON DELETE SET NULL,
  notes             TEXT,
  invoice_url       TEXT,
  invoice_filename  VARCHAR(255),
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);
