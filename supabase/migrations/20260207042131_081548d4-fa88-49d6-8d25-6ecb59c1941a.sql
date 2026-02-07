-- Backfill empresa_matricula from employers table for existing records
UPDATE public.sindical_associados sa
SET empresa_matricula = e.registration_number
FROM public.employers e
WHERE sa.employer_id = e.id
AND sa.empresa_matricula IS NULL
AND e.registration_number IS NOT NULL;