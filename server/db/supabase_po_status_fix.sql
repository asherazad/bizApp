-- Fix purchase_orders status constraint to include all app values
-- Run in Supabase SQL Editor
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft', 'sent', 'acknowledged', 'partially_invoiced', 'fully_invoiced', 'cancelled'));
