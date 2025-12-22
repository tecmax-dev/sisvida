-- Permite que admins da clínica atualizem perfis de membros da mesma clínica
CREATE POLICY "Admins can update profiles of clinic members"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.clinic_id = ur2.clinic_id
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = profiles.user_id
    AND ur1.role IN ('owner', 'admin')
  )
);