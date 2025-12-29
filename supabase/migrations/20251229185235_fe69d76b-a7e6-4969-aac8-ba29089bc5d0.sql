-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Clinic admins can insert patient cards" ON public.patient_cards;

-- Create a more permissive insert policy for clinic staff
CREATE POLICY "Clinic staff can insert patient cards"
ON public.patient_cards
FOR INSERT
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));