-- Drop existing policy and recreate with proper WITH CHECK clause
DROP POLICY IF EXISTS "Admins can manage professional specialties" ON professional_specialties;

CREATE POLICY "Admins can manage professional specialties" 
  ON professional_specialties FOR ALL
  USING (EXISTS (
    SELECT 1 FROM professionals p 
    WHERE p.id = professional_specialties.professional_id 
    AND is_clinic_admin(auth.uid(), p.clinic_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM professionals p 
    WHERE p.id = professional_id 
    AND is_clinic_admin(auth.uid(), p.clinic_id)
  ));