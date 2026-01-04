-- Atualizar contribuições existentes com valor 0 para o novo status
UPDATE employer_contributions
SET status = 'awaiting_value'
WHERE value = 0 AND status IN ('pending', 'overdue');