-- Drop existing restrictive UPDATE policy
DROP POLICY IF EXISTS "Clinic admins can update patient cards" ON public.patient_cards;

-- Create new policy allowing clinic staff to update patient cards
CREATE POLICY "Clinic staff can update patient cards"
ON public.patient_cards
FOR UPDATE
USING (has_clinic_access(auth.uid(), clinic_id))
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));