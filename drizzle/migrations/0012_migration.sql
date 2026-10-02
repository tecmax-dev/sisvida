ALTER TABLE public.employer_workers ADD COLUMN IF NOT EXISTS contribution_type_id uuid REFERENCES public.contribution_types(id) ON DELETE SET NULL;
ALTER TABLE public.employer_workers DROP CONSTRAINT IF EXISTS employer_workers_employer_id_name_norm_key;

WITH t AS (
  SELECT DISTINCT ri.worker_id, ri.contribution_type_id
  FROM public.employer_worker_roster_items ri WHERE ri.contribution_type_id IS NOT NULL
), first_t AS (
  SELECT DISTINCT ON (worker_id) worker_id, contribution_type_id FROM t ORDER BY worker_id, contribution_type_id
)
UPDATE public.employer_workers w SET contribution_type_id = f.contribution_type_id
FROM first_t f WHERE f.worker_id = w.id AND w.contribution_type_id IS NULL;

DO $$
DECLARE r record; nid uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT w.id wid, ri.contribution_type_id tid
    FROM public.employer_worker_roster_items ri JOIN public.employer_workers w ON w.id = ri.worker_id
    WHERE ri.contribution_type_id IS NOT NULL AND ri.contribution_type_id <> w.contribution_type_id
  LOOP
    INSERT INTO public.employer_workers (clinic_id, employer_id, name, name_norm, cpf, active, inactive_reason, inactive_note, inactive_at, contribution_type_id)
    SELECT clinic_id, employer_id, name, name_norm, cpf, active, inactive_reason, inactive_note, inactive_at, r.tid FROM public.employer_workers WHERE id = r.wid
    RETURNING id INTO nid;
    UPDATE public.employer_worker_roster_items SET worker_id = nid WHERE worker_id = r.wid AND contribution_type_id = r.tid;
  END LOOP;
END $$;

ALTER TABLE public.employer_workers ADD CONSTRAINT employer_workers_employer_type_name_key UNIQUE NULLS NOT DISTINCT (employer_id, contribution_type_id, name_norm);