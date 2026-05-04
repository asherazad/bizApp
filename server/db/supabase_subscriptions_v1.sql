-- ═══════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS + CREDIT CARD BALANCE v1 — run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Credit card balance tracker (single card)
CREATE TABLE IF NOT EXISTS credit_cards (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL DEFAULT 'Main Credit Card',
  current_balance  NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency         VARCHAR(10)  NOT NULL DEFAULT 'PKR',
  credit_limit     NUMERIC(18,2),
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- Seed the single CC record
INSERT INTO credit_cards (name, current_balance, currency)
SELECT 'Main Credit Card', 0, 'PKR'
WHERE NOT EXISTS (SELECT 1 FROM credit_cards);

-- 2. Extend credit_card_txns with type and reference
ALTER TABLE credit_card_txns
  ADD COLUMN IF NOT EXISTS credit_card_id  UUID         REFERENCES credit_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS txn_type        VARCHAR(10)  NOT NULL DEFAULT 'debit',
  ADD COLUMN IF NOT EXISTS reference_type  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reference_id    UUID;

-- 3. Extend subscriptions for the revamp
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_paid_date  DATE,
  ADD COLUMN IF NOT EXISTS last_paid_amount NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS credit_card_id  UUID         REFERENCES credit_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_url      TEXT;

-- Sync status from is_active for existing records
UPDATE subscriptions SET status = CASE WHEN is_active THEN 'active' ELSE 'paused' END
WHERE status = 'active' AND is_active = false;
