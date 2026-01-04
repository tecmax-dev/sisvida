-- Remover a constraint absoluta que está bloqueando a geração de 2ª via
-- A constraint parcial (unique_active_contribution_per_employer) já existe e é a correta
ALTER TABLE employer_contributions DROP CONSTRAINT IF EXISTS employer_contributions_unique_competence;