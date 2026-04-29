-- Add po_title column to purchase_orders
-- Run in Supabase SQL Editor
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_title text;
