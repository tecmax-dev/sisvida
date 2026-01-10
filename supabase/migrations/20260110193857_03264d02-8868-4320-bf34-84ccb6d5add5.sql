-- Fix ON CONFLICT target: Postgres cannot use a PARTIAL unique index for ON CONFLICT (col)
-- Create a non-partial UNIQUE index on active_competence_key instead.

DROP INDEX IF EXISTS public.idx_employer_contributions_active_key;

-- Unique indexes allow multiple NULLs, so cancelled rows (active_competence_key NULL) remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_employer_contributions_active_key
ON public.employer_contributions (active_competence_key);