-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Admins de entidades sindicais podem atualizar associados" ON public.sindical_associados;

-- Create new UPDATE policy with proper access check (same logic as SELECT)
CREATE POLICY "Admins de entidades sindicais podem atualizar associados" 
ON public.sindical_associados 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM public.union_entities ue
    WHERE ue.id = sindical_associados.sindicato_id
    AND (
      ue.user_id = auth.uid()
      OR (ue.clinic_id IS NOT NULL AND has_clinic_access(auth.uid(), ue.clinic_id))
      OR is_super_admin(auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.union_entities ue
    WHERE ue.id = sindical_associados.sindicato_id
    AND (
      ue.user_id = auth.uid()
      OR (ue.clinic_id IS NOT NULL AND has_clinic_access(auth.uid(), ue.clinic_id))
      OR is_super_admin(auth.uid())
    )
  )
);