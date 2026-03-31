-- Add DELETE policies for clinic admins on state_holidays, municipal_holidays, and national_holidays
CREATE POLICY "Clinic admins can delete state holidays"
ON public.state_holidays
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Clinic admins can delete municipal holidays"
ON public.municipal_holidays
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Clinic admins can delete national holidays"
ON public.national_holidays
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);