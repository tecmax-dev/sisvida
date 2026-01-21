-- Drop the broken policy
DROP POLICY IF EXISTS "Users can manage their clinic previews" ON public.negotiation_previews;

-- Allow authenticated users to INSERT previews for their clinic
CREATE POLICY "Users can insert their clinic previews"
ON public.negotiation_previews
FOR INSERT
TO authenticated
WITH CHECK (
  clinic_id IN (
    SELECT user_roles.clinic_id FROM user_roles WHERE user_roles.user_id = auth.uid()
  )
);

-- Allow authenticated users to UPDATE their clinic's previews
CREATE POLICY "Users can update their clinic previews"
ON public.negotiation_previews
FOR UPDATE
TO authenticated
USING (
  clinic_id IN (
    SELECT user_roles.clinic_id FROM user_roles WHERE user_roles.user_id = auth.uid()
  )
);

-- Allow authenticated users to DELETE their clinic's previews
CREATE POLICY "Users can delete their clinic previews"
ON public.negotiation_previews
FOR DELETE
TO authenticated
USING (
  clinic_id IN (
    SELECT user_roles.clinic_id FROM user_roles WHERE user_roles.user_id = auth.uid()
  )
);