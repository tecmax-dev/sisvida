-- Add RLS policy for Super Admins to manage all dependents
CREATE POLICY "Super admins can manage all dependents" 
ON public.patient_dependents 
FOR ALL 
TO public 
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));