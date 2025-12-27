-- Drop existing policies
DROP POLICY IF EXISTS "cost_centers_admin" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers_select" ON public.cost_centers;

-- Create proper RLS policies for cost_centers
-- SELECT: users with clinic access can view active cost centers
CREATE POLICY "cost_centers_select" ON public.cost_centers
  FOR SELECT
  USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

-- INSERT: clinic admins can create cost centers
CREATE POLICY "cost_centers_insert" ON public.cost_centers
  FOR INSERT
  WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

-- UPDATE: clinic admins can update cost centers
CREATE POLICY "cost_centers_update" ON public.cost_centers
  FOR UPDATE
  USING (is_clinic_admin(auth.uid(), clinic_id))
  WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

-- DELETE: clinic admins can delete cost centers
CREATE POLICY "cost_centers_delete" ON public.cost_centers
  FOR DELETE
  USING (is_clinic_admin(auth.uid(), clinic_id));