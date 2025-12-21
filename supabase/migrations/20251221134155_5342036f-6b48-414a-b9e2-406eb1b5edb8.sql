-- Adicionar política para super admins atualizarem todas as clínicas
CREATE POLICY "Super admins can update all clinics"
ON public.clinics
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));