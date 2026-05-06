-- Add granular permissions JSONB to wing_access_grants
-- Each row stores per-feature permissions for a user on a specific business wing
-- e.g. { "invoices_view": true, "invoices_create": false, "payroll_process": false, ... }
ALTER TABLE wing_access_grants ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
