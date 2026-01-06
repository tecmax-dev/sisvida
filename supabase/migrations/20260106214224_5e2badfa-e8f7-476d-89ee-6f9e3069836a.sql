
-- Add generated column for active contribution key (NULL when cancelled, otherwise unique key)
ALTER TABLE public.employer_contributions 
ADD COLUMN active_competence_key text GENERATED ALWAYS AS (
  CASE WHEN status <> 'cancelled'
    THEN employer_id::text || ':' || contribution_type_id::text || ':' || competence_year::text || ':' || competence_month::text
    ELSE NULL
  END
) STORED;

-- Create unique index on the generated column (NULLs don't conflict in Postgres)
CREATE UNIQUE INDEX employer_contributions_active_competence_key_uniq 
ON public.employer_contributions (active_competence_key) 
WHERE active_competence_key IS NOT NULL;

-- Drop the old partial index that was causing upsert failures
DROP INDEX IF EXISTS unique_active_contribution_per_employer;
