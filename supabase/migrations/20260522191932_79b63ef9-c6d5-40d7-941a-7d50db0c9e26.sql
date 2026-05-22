-- Allow union entity admins to manage dependent approvals for their clinic
CREATE POLICY "Union entity admins can manage dependent approvals"
ON public.pending_dependent_approvals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.union_entities ue
    WHERE ue.clinic_id = pending_dependent_approvals.clinic_id
      AND ue.status = 'ativa'
      AND (
        ue.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'entidade_sindical_admin'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.union_entities ue
    WHERE ue.clinic_id = pending_dependent_approvals.clinic_id
      AND ue.status = 'ativa'
      AND (
        ue.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'entidade_sindical_admin'
        )
      )
  )
);

-- Same for patient_dependents so activation works
CREATE POLICY "Union entity admins can update patient dependents"
ON public.patient_dependents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.union_entities ue
    WHERE ue.clinic_id = patient_dependents.clinic_id
      AND ue.status = 'ativa'
      AND (
        ue.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'entidade_sindical_admin'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.union_entities ue
    WHERE ue.clinic_id = patient_dependents.clinic_id
      AND ue.status = 'ativa'
      AND (
        ue.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'entidade_sindical_admin'
        )
      )
  )
);