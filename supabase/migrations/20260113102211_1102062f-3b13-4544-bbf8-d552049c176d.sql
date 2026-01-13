-- Drop the broken INSERT policy
DROP POLICY IF EXISTS "Union entity admins can insert payment history" ON public.union_payment_history;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Union entity admins can insert payment history"
ON public.union_payment_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM union_entities ue
    WHERE ue.id = entity_id
    AND (
      ue.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.clinic_id = ue.clinic_id
      )
      OR is_super_admin(auth.uid())
    )
  )
);