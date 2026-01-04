-- Remove a constraint atual que não considera status
ALTER TABLE public.employer_contributions 
DROP CONSTRAINT IF EXISTS unique_contribution_per_employer;

-- Cria índice único parcial que permite nova contribuição se a anterior foi cancelada
CREATE UNIQUE INDEX unique_active_contribution_per_employer 
ON public.employer_contributions (employer_id, contribution_type_id, competence_month, competence_year)
WHERE status NOT IN ('cancelled');