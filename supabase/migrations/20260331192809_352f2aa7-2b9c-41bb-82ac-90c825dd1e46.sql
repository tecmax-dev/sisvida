-- Drop the restrictive super_admins-only policy
DROP POLICY IF EXISTS "Super admins manage app tabs" ON public.mobile_app_tabs;

-- Create a new policy that allows both super admins AND clinic admins to manage tabs
CREATE POLICY "Admins manage app tabs" ON public.mobile_app_tabs
  FOR ALL
  TO authenticated
  USING (
    is_super_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
        AND ur.access_group_id IS NULL
    )
  )
  WITH CHECK (
    is_super_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
        AND ur.access_group_id IS NULL
    )
  );