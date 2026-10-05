ALTER TABLE public.contribution_types ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'lytex' CHECK (billing_provider IN ('lytex','sicoob'));
ALTER TABLE public.employer_contributions
  ADD COLUMN IF NOT EXISTS sicoob_nosso_numero bigint,
  ADD COLUMN IF NOT EXISTS sicoob_linha_digitavel text,
  ADD COLUMN IF NOT EXISTS sicoob_codigo_barras text,
  ADD COLUMN IF NOT EXISTS sicoob_pdf_path text,
  ADD COLUMN IF NOT EXISTS sicoob_situacao text,
  ADD COLUMN IF NOT EXISTS sicoob_raw jsonb,
  ADD COLUMN IF NOT EXISTS last_sicoob_sync_at timestamptz;
INSERT INTO public.contribution_types (clinic_id, name, description, default_value, is_active, billing_provider)
SELECT '89e7585e-7bce-4e58-91fa-c37080d1170d', 'Homologa Sicoob 26', 'Tipo de teste para boletos emitidos pelo Sicoob', 0, true, 'sicoob'
WHERE NOT EXISTS (SELECT 1 FROM public.contribution_types WHERE clinic_id='89e7585e-7bce-4e58-91fa-c37080d1170d' AND name='Homologa Sicoob 26');