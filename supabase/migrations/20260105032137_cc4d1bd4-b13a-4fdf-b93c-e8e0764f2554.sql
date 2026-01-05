-- Add DELETE policy for negotiation_installments
CREATE POLICY "Users can delete negotiation installments for their clinic"
ON public.negotiation_installments
FOR DELETE
USING (
  negotiation_id IN (
    SELECT dn.id
    FROM debt_negotiations dn
    WHERE dn.clinic_id IN (
      SELECT ur.clinic_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  )
);