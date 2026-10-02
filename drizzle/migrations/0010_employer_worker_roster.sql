CREATE TABLE public.employer_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_norm text NOT NULL,
  cpf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employer_id, name_norm)
);
GRANT SELECT ON public.employer_workers TO authenticated;
GRANT ALL ON public.employer_workers TO service_role;
ALTER TABLE public.employer_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read employer workers" ON public.employer_workers FOR SELECT TO authenticated
  USING (clinic_id IS NOT NULL AND public.has_clinic_access(auth.uid(), clinic_id));

CREATE TABLE public.employer_worker_roster_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  contribution_id uuid NOT NULL,
  contribution_type_id uuid,
  competence_month int,
  competence_year int,
  worker_id uuid NOT NULL REFERENCES public.employer_workers(id) ON DELETE CASCADE,
  origin text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contribution_id, worker_id)
);
CREATE INDEX ON public.employer_worker_roster_items (employer_id, competence_year, competence_month);
GRANT SELECT ON public.employer_worker_roster_items TO authenticated;
GRANT ALL ON public.employer_worker_roster_items TO service_role;
ALTER TABLE public.employer_worker_roster_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read roster items" ON public.employer_worker_roster_items FOR SELECT TO authenticated
  USING (clinic_id IS NOT NULL AND public.has_clinic_access(auth.uid(), clinic_id));