ALTER TABLE public.global_config
  ADD COLUMN IF NOT EXISTS sms_provider text NOT NULL DEFAULT 'comtele'
    CHECK (sms_provider IN ('comtele', 'apibrasil'));
GRANT SELECT ON public.global_config TO authenticated;
