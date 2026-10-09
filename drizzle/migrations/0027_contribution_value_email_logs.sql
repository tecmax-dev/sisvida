CREATE TABLE public.contribution_value_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  contribution_id uuid,
  employer_id uuid,
  employer_name text,
  portal_type text,
  document_number text,
  invoice_url text,
  recipient text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contribution_value_email_logs TO authenticated;
GRANT ALL ON public.contribution_value_email_logs TO service_role;
ALTER TABLE public.contribution_value_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff can view value email logs" ON public.contribution_value_email_logs
  FOR SELECT TO authenticated USING (public.has_clinic_access(auth.uid(), clinic_id));
CREATE INDEX idx_cvel_clinic_created ON public.contribution_value_email_logs (clinic_id, created_at DESC);