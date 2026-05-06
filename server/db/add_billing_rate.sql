-- Add billing_rate column to resources (hourly/daily client billing rate for utilisation tracking)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS billing_rate NUMERIC(12,2);
