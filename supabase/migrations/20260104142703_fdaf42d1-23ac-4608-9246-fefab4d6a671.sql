-- 1) Deduplicar contribuições por competência (mantém o registro mais “definitivo”)
-- Critério: status (paid > overdue > processing > pending > cancelled) e depois updated_at desc
WITH ranked AS (
  SELECT
    id,
    employer_id,
    contribution_type_id,
    competence_month,
    competence_year,
    status,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY employer_id, contribution_type_id, competence_month, competence_year
      ORDER BY
        CASE status
          WHEN 'paid' THEN 5
          WHEN 'overdue' THEN 4
          WHEN 'processing' THEN 3
          WHEN 'pending' THEN 2
          WHEN 'cancelled' THEN 1
          ELSE 0
        END DESC,
        updated_at DESC
    ) AS rn
  FROM public.employer_contributions
)
DELETE FROM public.employer_contributions ec
USING ranked r
WHERE ec.id = r.id
  AND r.rn > 1;

-- 2) Garantir constraint única compatível com UPSERT/ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employer_contributions_unique_competence'
      AND conrelid = 'public.employer_contributions'::regclass
  ) THEN
    ALTER TABLE public.employer_contributions
      ADD CONSTRAINT employer_contributions_unique_competence
      UNIQUE (employer_id, contribution_type_id, competence_month, competence_year);
  END IF;
END $$;