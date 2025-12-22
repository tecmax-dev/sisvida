-- Drop the existing policy that's missing WITH CHECK
DROP POLICY IF EXISTS "Users can manage waiting list of their clinics" ON public.waiting_list;

-- Recreate the policy with both USING and WITH CHECK clauses
CREATE POLICY "Users can manage waiting list of their clinics"
ON public.waiting_list
FOR ALL
TO public
USING (has_clinic_access(auth.uid(), clinic_id))
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));