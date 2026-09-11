CREATE TABLE public.whatsapp_opt_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'consent_button',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);
GRANT SELECT ON public.whatsapp_opt_ins TO authenticated;
GRANT ALL ON public.whatsapp_opt_ins TO service_role;
ALTER TABLE public.whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view opt-ins" ON public.whatsapp_opt_ins FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_whatsapp_opt_ins_phone ON public.whatsapp_opt_ins (clinic_id, phone);