-- Permitir que usuários autenticados verifiquem se eles mesmos são super admin
CREATE POLICY "Users can check if they are super admin"
ON public.super_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());