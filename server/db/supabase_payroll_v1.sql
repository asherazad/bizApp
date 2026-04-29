-- ═══════════════════════════════════════════════════════════════════
-- PAYROLL v1 — run in Supabase SQL Editor
-- Creates payroll_runs table for monthly salary processing.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payroll_runs (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id       UUID          NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  business_wing_id  UUID          REFERENCES business_wings(id) ON DELETE SET NULL,
  month_year        VARCHAR(7)    NOT NULL,           -- 'YYYY-MM'
  working_days      INTEGER       NOT NULL DEFAULT 26,
  present_days      INTEGER       NOT NULL DEFAULT 26,
  gross_salary      NUMERIC(18,2) NOT NULL DEFAULT 0,
  basic_earned      NUMERIC(18,2) NOT NULL DEFAULT 0,
  allowances_earned NUMERIC(18,2) NOT NULL DEFAULT 0,
  overtime_hours    NUMERIC(8,2)  NOT NULL DEFAULT 0,
  overtime_rate     NUMERIC(18,2) NOT NULL DEFAULT 0,
  overtime_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  loan_deduction    NUMERIC(18,2) NOT NULL DEFAULT 0,
  advance_deduction NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_deduction     NUMERIC(18,2) NOT NULL DEFAULT 0,
  other_deductions  NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_salary        NUMERIC(18,2) NOT NULL DEFAULT 0,
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft',
  payment_date      DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(resource_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_resource ON payroll_runs(resource_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month    ON payroll_runs(month_year);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_wing     ON payroll_runs(business_wing_id);
