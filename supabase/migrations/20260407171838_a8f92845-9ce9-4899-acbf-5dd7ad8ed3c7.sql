CREATE POLICY "anon_can_insert_homologacao_appointments"
ON public.homologacao_appointments
FOR INSERT
TO anon
WITH CHECK (
  status = 'scheduled'
  AND clinic_id IS NOT NULL
  AND professional_id IS NOT NULL
  AND employee_name IS NOT NULL
  AND company_name IS NOT NULL
);