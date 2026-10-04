CREATE TABLE public.waiting_list_pick_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  waiting_list_id uuid NOT NULL REFERENCES public.waiting_list(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  appointment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.waiting_list_pick_tokens TO service_role;
ALTER TABLE public.waiting_list_pick_tokens ENABLE ROW LEVEL SECURITY;