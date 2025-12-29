-- Allow Super Admins to manage all professionals for data import
CREATE POLICY "Super admins can manage all professionals"
ON public.professionals
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));