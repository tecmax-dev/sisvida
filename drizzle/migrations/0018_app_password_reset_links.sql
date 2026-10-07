CREATE TABLE public.app_password_reset_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_password_reset_links TO service_role;
ALTER TABLE public.app_password_reset_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_password_reset_links_patient_idx ON public.app_password_reset_links(patient_id, created_at DESC);