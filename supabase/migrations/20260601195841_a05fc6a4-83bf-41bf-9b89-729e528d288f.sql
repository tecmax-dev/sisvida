DROP POLICY IF EXISTS "Clinic members can delete slot blocks" ON public.appointment_slot_blocks;

CREATE POLICY "Only admins can delete slot blocks"
ON public.appointment_slot_blocks
FOR DELETE
USING (public.is_clinic_admin(auth.uid(), clinic_id));
