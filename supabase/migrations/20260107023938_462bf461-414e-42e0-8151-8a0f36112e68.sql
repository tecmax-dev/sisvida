-- Drop the partial unique index and create a non-partial one
-- NULLs are treated as distinct so duplicates on cancelled contributions wont violate uniqueness.

DROP INDEX IF EXISTS public.employer_contributions_active_competence_key_uniq;

CREATE UNIQUE INDEX employer_contributions_active_competence_key_uidx
  ON public.employer_contributions (active_competence_key);