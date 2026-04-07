
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Clinic admins can manage their group permissions" ON public.access_group_permissions;

-- Create an updated policy that also allows clinic admins to manage system groups (clinic_id IS NULL)
-- that belong to the union module, as long as the admin has access to the sindicato clinic
CREATE POLICY "Clinic admins can manage their group permissions" ON public.access_group_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM access_groups ag
    WHERE ag.id = access_group_permissions.access_group_id
    AND (
      -- Original: clinic-specific groups
      (ag.clinic_id IS NOT NULL AND is_clinic_admin(auth.uid(), ag.clinic_id))
      OR
      -- New: system groups (clinic_id IS NULL) - allow if user is admin of any clinic
      (ag.clinic_id IS NULL AND ag.is_system = true AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
        AND ur.access_group_id IS NULL
      ))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM access_groups ag
    WHERE ag.id = access_group_permissions.access_group_id
    AND (
      (ag.clinic_id IS NOT NULL AND is_clinic_admin(auth.uid(), ag.clinic_id))
      OR
      (ag.clinic_id IS NULL AND ag.is_system = true AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
        AND ur.access_group_id IS NULL
      ))
    )
  )
);
