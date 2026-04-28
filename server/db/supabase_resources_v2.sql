-- ═══════════════════════════════════════════════════════════════════
-- RESOURCES v2 — run in Supabase SQL Editor
-- Adds all Excel columns to the resources table and creates the
-- resource_inventory table for assigned equipment tracking.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Add missing columns to resources ─────────────────────
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS business_wing_id   UUID REFERENCES business_wings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_name          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS designation        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS account_number     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_name          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mode_of_transfer   VARCHAR(50),   -- Bank Transfer | Cash | Cheque
  ADD COLUMN IF NOT EXISTS job_type           VARCHAR(50),   -- On-Site | Remote | out Source | Part time
  ADD COLUMN IF NOT EXISTS employment_status  VARCHAR(50),   -- Permanent | Probation | 3rd party | Hybrid | Part time
  ADD COLUMN IF NOT EXISTS join_date          DATE,
  ADD COLUMN IF NOT EXISTS gross_salary       NUMERIC(18,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount         NUMERIC(18,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_salary         NUMERIC(18,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resource_seq_id    INTEGER;       -- original numeric ID from Excel

-- ── Step 2: Create resource_inventory table ───────────────────────
CREATE TABLE IF NOT EXISTS resource_inventory (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id    UUID        NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  item_name      VARCHAR(255) NOT NULL,
  description    TEXT,
  serial_number  VARCHAR(100),
  assigned_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  returned_date  DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_inventory_resource ON resource_inventory(resource_id);

-- ── Step 3: Indexes for fast filtering ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_resources_wing   ON resources(business_wing_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(employment_status);
CREATE INDEX IF NOT EXISTS idx_resources_name   ON resources(full_name);

-- ── Step 4: Verify ────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'resources' ORDER BY ordinal_position;
-- SELECT COUNT(*) FROM resource_inventory;
