-- Drop the problematic ALL policy that lacks WITH CHECK
DROP POLICY IF EXISTS "Users can manage attachments of their clinics" ON public.patient_attachments;

-- Recreate with proper WITH CHECK for INSERT/UPDATE
CREATE POLICY "Users can manage attachments of their clinics"
ON public.patient_attachments
FOR ALL
TO authenticated
USING (has_clinic_access(auth.uid(), clinic_id))
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));