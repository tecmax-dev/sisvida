-- Política para permitir acesso público aos dados de pacientes quando consultados via carteirinha
CREATE POLICY "Public can view patient name via card token"
ON public.patients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patient_cards 
    WHERE patient_cards.patient_id = patients.id 
    AND patient_cards.qr_code_token IS NOT NULL
  )
);

-- Política para permitir acesso público aos dados básicos da clínica quando consultados via carteirinha
CREATE POLICY "Public can view clinic info via card token"
ON public.clinics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patient_cards 
    WHERE patient_cards.clinic_id = clinics.id 
    AND patient_cards.qr_code_token IS NOT NULL
  )
);