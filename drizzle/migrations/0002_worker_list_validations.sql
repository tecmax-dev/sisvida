CREATE TABLE public.contribution_worker_list_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  employer_id uuid NOT NULL,
  contribution_id uuid NOT NULL,
  contribution_type_id uuid,
  competence_month int,
  competence_year int,
  portal_type text NOT NULL CHECK (portal_type IN ('employer','accounting_office')),
  portal_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  status text NOT NULL CHECK (status IN ('valid','invalid')),
  confidence numeric,
  ai_result jsonb,
  extracted_data jsonb,
  inconsistencies jsonb,
  reason text,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.contribution_worker_list_validations TO service_role;
GRANT SELECT ON public.contribution_worker_list_validations TO authenticated;
ALTER TABLE public.contribution_worker_list_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view worker list validations"
ON public.contribution_worker_list_validations FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), clinic_id));
CREATE INDEX idx_cwlv_contribution ON public.contribution_worker_list_validations(contribution_id, created_at DESC);