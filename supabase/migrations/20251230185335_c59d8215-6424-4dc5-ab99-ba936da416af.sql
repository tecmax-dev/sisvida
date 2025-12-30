-- Drop existing check constraint and recreate with subscription source
ALTER TABLE mercado_pago_payments 
DROP CONSTRAINT IF EXISTS mercado_pago_payments_source_check;

ALTER TABLE mercado_pago_payments 
ADD CONSTRAINT mercado_pago_payments_source_check 
CHECK (source IN ('transaction', 'quote', 'package', 'subscription'));