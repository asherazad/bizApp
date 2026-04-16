-- ═══════════════════════════════════════════════════════════
-- BizPortal — Invoicing & Quotation Schema
-- Migration: 002_invoicing.sql
-- ═══════════════════════════════════════════════════════════

-- ─── Clients ─────────────────────────────────────────────
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(255),
  phone         VARCHAR(50),
  address       TEXT,
  city          VARCHAR(100),
  country       VARCHAR(100),
  tax_number    VARCHAR(100),   -- VAT / GST / NTN
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_tenant    ON clients(tenant_id);
CREATE INDEX idx_clients_name      ON clients(tenant_id, name);

-- ─── Unified document table (invoices + quotations) ──────
-- Using a single table with a `type` discriminator.
-- This keeps history clean and allows quotation→invoice conversion.

CREATE TYPE doc_type   AS ENUM ('invoice', 'quotation');
CREATE TYPE doc_status AS ENUM (
  -- shared
  'draft', 'sent',
  -- invoice only
  'viewed', 'paid', 'partial', 'overdue', 'cancelled',
  -- quotation only
  'accepted', 'rejected', 'converted'
);

CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dept_id           UUID NOT NULL REFERENCES departments(id),
  client_id         UUID NOT NULL REFERENCES clients(id),
  type              doc_type   NOT NULL DEFAULT 'invoice',
  status            doc_status NOT NULL DEFAULT 'draft',

  -- Numbering
  number            VARCHAR(50) NOT NULL,   -- e.g. INV-2025-0044 / QUO-2025-0012
  reference         VARCHAR(100),           -- PO number or external ref
  converted_from    UUID REFERENCES invoices(id),  -- quotation → invoice link

  -- Dates
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,

  -- Client snapshot (denormalised so edits to client don't change old docs)
  client_name       VARCHAR(200) NOT NULL,
  client_email      VARCHAR(255),
  client_address    TEXT,

  -- Currency & totals (stored in minor units? No — store as NUMERIC for clarity)
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_type     VARCHAR(10) DEFAULT 'percent',   -- 'percent' | 'fixed'
  discount_value    NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total             NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid       NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_due        NUMERIC(14,2) GENERATED ALWAYS AS (total - amount_paid) STORED,

  -- Content
  notes             TEXT,
  terms             TEXT,

  -- Meta
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invoices_number  ON invoices(tenant_id, number);
CREATE        INDEX idx_invoices_tenant  ON invoices(tenant_id);
CREATE        INDEX idx_invoices_client  ON invoices(tenant_id, client_id);
CREATE        INDEX idx_invoices_status  ON invoices(tenant_id, status);
CREATE        INDEX idx_invoices_dept    ON invoices(tenant_id, dept_id);
CREATE        INDEX idx_invoices_due     ON invoices(tenant_id, due_date) WHERE status NOT IN ('paid','cancelled','converted');

-- ─── Line items ──────────────────────────────────────────
CREATE TABLE invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct  NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- line-level discount %
  tax_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- line-level tax %
  -- Computed and stored for reporting / PDF
  line_total    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- qty * unit_price
  discount_amt  NUMERIC(14,2) NOT NULL DEFAULT 0,   -- line_total * disc%
  taxable_amt   NUMERIC(14,2) NOT NULL DEFAULT 0,   -- line_total - discount_amt
  tax_amt       NUMERIC(14,2) NOT NULL DEFAULT 0,   -- taxable_amt * tax%
  net_total     NUMERIC(14,2) NOT NULL DEFAULT 0    -- taxable_amt + tax_amt
);

CREATE INDEX idx_items_invoice ON invoice_items(invoice_id);

-- ─── Payments ────────────────────────────────────────────
CREATE TYPE payment_method AS ENUM ('cash','bank_transfer','cheque','card','other');

CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  method        payment_method NOT NULL DEFAULT 'bank_transfer',
  reference     VARCHAR(100),   -- cheque no, transaction ID, etc.
  note          TEXT,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_tenant  ON payments(tenant_id);

-- ─── Invoice sequence counters ────────────────────────────
-- Used to generate sequential numbers per tenant per type
CREATE TABLE invoice_sequences (
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type       doc_type NOT NULL,
  year       SMALLINT NOT NULL,
  last_seq   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, type, year)
);

-- ─── Triggers: updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at  BEFORE UPDATE ON clients  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Helper: next invoice number ─────────────────────────
CREATE OR REPLACE FUNCTION next_invoice_number(
  p_tenant_id UUID, p_type doc_type
) RETURNS VARCHAR AS $$
DECLARE
  v_year   SMALLINT := EXTRACT(YEAR FROM NOW());
  v_seq    INTEGER;
  v_prefix VARCHAR(3) := CASE p_type WHEN 'invoice' THEN 'INV' ELSE 'QUO' END;
BEGIN
  INSERT INTO invoice_sequences(tenant_id, type, year, last_seq)
    VALUES(p_tenant_id, p_type, v_year, 1)
    ON CONFLICT(tenant_id, type, year)
    DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
    RETURNING last_seq INTO v_seq;

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
