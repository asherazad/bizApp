-- ═══════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS v2 — run in Supabase SQL Editor
-- Adds currency and amount columns missing from the manual DB creation.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS currency_code  VARCHAR(10)   NOT NULL DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS exchange_rate  NUMERIC(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pkr_amount     NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Sync pkr_amount from amount for existing rows
UPDATE subscriptions SET pkr_amount = amount WHERE pkr_amount = 0 AND amount > 0;
