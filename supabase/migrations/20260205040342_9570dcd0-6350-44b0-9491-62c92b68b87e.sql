-- Remove a constraint única que impede boletos duplicados para o mesmo mês
ALTER TABLE subscription_invoices DROP CONSTRAINT IF EXISTS unique_subscription_invoice_competence;

-- Também remover o índice se existir separadamente
DROP INDEX IF EXISTS unique_subscription_invoice_competence;