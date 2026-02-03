
-- Corrigir política de SELECT para sindical_associados
-- O problema é que a política atual verifica apenas se o usuário é user_id de uma union_entity,
-- mas não considera o acesso via clinic_id

-- Drop da política atual
DROP POLICY IF EXISTS "Admins de entidades sindicais podem visualizar associados" ON public.sindical_associados;

-- Nova política que verifica acesso via clinic_id da union_entity
CREATE POLICY "Admins podem visualizar associados via clinic"
ON public.sindical_associados
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.union_entities ue
    WHERE ue.id = sindical_associados.sindicato_id
    AND (
      -- Usuário é admin direto da entidade
      ue.user_id = auth.uid()
      -- OU usuário tem acesso à clínica vinculada
      OR (ue.clinic_id IS NOT NULL AND has_clinic_access(auth.uid(), ue.clinic_id))
      -- OU é super admin
      OR is_super_admin(auth.uid())
    )
  )
);
