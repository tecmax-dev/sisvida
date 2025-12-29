-- Add policy for Super Admins to manage all medical records
CREATE POLICY "Super admins can manage all medical records"
ON public.medical_records
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));