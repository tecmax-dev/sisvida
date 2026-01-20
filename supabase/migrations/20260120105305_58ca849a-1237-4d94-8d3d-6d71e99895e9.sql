-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage contributions" ON public.employer_contributions;

-- Create a new, more comprehensive policy that includes super admins
-- and users with entidade_sindical_admin role (checking via user_roles with special cast)
CREATE POLICY "Admins can manage contributions" 
ON public.employer_contributions 
FOR ALL 
USING (
  -- Super admins have full access
  public.is_super_admin(auth.uid())
  OR
  -- Clinic admins (owner/admin role) have access
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR
  -- Union entity admins (entidade_sindical_admin role) have access to their clinic
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
      AND clinic_id = employer_contributions.clinic_id 
      AND role::text = 'entidade_sindical_admin'
  )
)
WITH CHECK (
  -- Super admins have full access
  public.is_super_admin(auth.uid())
  OR
  -- Clinic admins (owner/admin role) have access  
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR
  -- Union entity admins have access to their clinic
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
      AND clinic_id = employer_contributions.clinic_id 
      AND role::text = 'entidade_sindical_admin'
  )
);