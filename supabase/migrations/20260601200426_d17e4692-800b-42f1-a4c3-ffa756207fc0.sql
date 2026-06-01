DROP POLICY IF EXISTS "Clinic members can insert slot blocks" ON public.appointment_slot_blocks;
DROP POLICY IF EXISTS "Clinic members can update slot blocks" ON public.appointment_slot_blocks;

CREATE POLICY "Only admins or professionals can insert slot blocks"
ON public.appointment_slot_blocks
FOR INSERT
WITH CHECK (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = appointment_slot_blocks.clinic_id
      AND ur.role = 'professional'
  )
);

CREATE POLICY "Only admins or professionals can update slot blocks"
ON public.appointment_slot_blocks
FOR UPDATE
USING (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = appointment_slot_blocks.clinic_id
      AND ur.role = 'professional'
  )
)
WITH CHECK (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.clinic_id = appointment_slot_blocks.clinic_id
      AND ur.role = 'professional'
  )
);