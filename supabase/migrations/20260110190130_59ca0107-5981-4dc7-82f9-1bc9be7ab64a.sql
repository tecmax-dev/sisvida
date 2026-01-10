-- Remove a constraint antiga que bloqueia valor zero com status overdue/pending
ALTER TABLE employer_contributions 
DROP CONSTRAINT IF EXISTS employer_contributions_value_check;

-- Adiciona nova constraint que aceita valor zero (apenas bloqueia negativos)
ALTER TABLE employer_contributions 
ADD CONSTRAINT employer_contributions_value_check 
CHECK (value >= 0);