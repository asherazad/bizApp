-- ═══════════════════════════════════════════════════════════════════
-- LOANS v1 — run in Supabase SQL Editor
-- Creates loan_records and loan_repayments tables if they don't exist.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS loan_records (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id         UUID          NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  business_wing_id    UUID          REFERENCES business_wings(id) ON DELETE SET NULL,
  loan_type           VARCHAR(20)   NOT NULL DEFAULT 'loan',  -- loan | advance
  amount              NUMERIC(18,2) NOT NULL,
  remaining_balance   NUMERIC(18,2) NOT NULL,
  issued_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  monthly_installment NUMERIC(18,2) DEFAULT 0,
  purpose             TEXT,
  status              VARCHAR(20)   NOT NULL DEFAULT 'active', -- active | settled | written_off
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID          NOT NULL REFERENCES loan_records(id) ON DELETE CASCADE,
  amount          NUMERIC(18,2) NOT NULL,
  repayment_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_records_resource   ON loan_records(resource_id);
CREATE INDEX IF NOT EXISTS idx_loan_records_status     ON loan_records(status);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan    ON loan_repayments(loan_id);
