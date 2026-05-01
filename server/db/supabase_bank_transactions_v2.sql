-- ═══════════════════════════════════════════════════════════════════
-- BANK TRANSACTIONS v2 — run in Supabase SQL Editor
-- Adds linked_resource_id column for linking transactions to resources.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS linked_resource_id UUID REFERENCES resources(id) ON DELETE SET NULL;
