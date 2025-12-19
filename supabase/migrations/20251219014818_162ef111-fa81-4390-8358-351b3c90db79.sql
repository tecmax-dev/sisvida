-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can manage professional specialties" ON professional_specialties;

-- Create new policy that allows any staff with clinic access to manage specialties
CREATE POLICY "Staff can manage professional specialties" 
ON professional_specialties 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = professional_specialties.professional_id 
    AND has_clinic_access(auth.uid(), p.clinic_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = professional_specialties.professional_id 
    AND has_clinic_access(auth.uid(), p.clinic_id)
  )
);