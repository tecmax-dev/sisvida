-- Permite que usuários vejam perfis de outros membros da mesma clínica
CREATE POLICY "Users can view profiles of same clinic members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.clinic_id = ur2.clinic_id
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = profiles.user_id
  )
);