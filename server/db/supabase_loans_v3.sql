-- ═══════════════════════════════════════════════════════════════════
-- LOANS v3 — run in Supabase SQL Editor
-- Drops and recreates loan tables cleanly (no business_wing_id —
-- the resource is already linked to a wing).
-- WARNING: this will delete any existing loan data.
-- ═══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS loan_records     CASCADE;

CREATE TABLE loan_records (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id         UUID          NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  loan_type           VARCHAR(20)   NOT NULL DEFAULT 'loan',
  amount              NUMERIC(18,2) NOT NULL,
  remaining_balance   NUMERIC(18,2) NOT NULL,
  issued_date         DATE          NOT NULL DEFAULT CURRENT_DATE,
  monthly_installment NUMERIC(18,2) DEFAULT 0,
  purpose             TEXT,
  status              VARCHAR(20)   NOT NULL DEFAULT 'active',
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE loan_repayments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         UUID          NOT NULL REFERENCES loan_records(id) ON DELETE CASCADE,
  amount          NUMERIC(18,2) NOT NULL,
  repayment_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loan_records_resource ON loan_records(resource_id);
CREATE INDEX idx_loan_records_status   ON loan_records(status);
CREATE INDEX idx_loan_repayments_loan  ON loan_repayments(loan_id);
