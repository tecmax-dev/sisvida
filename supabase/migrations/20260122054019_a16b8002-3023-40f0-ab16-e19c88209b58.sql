-- Allow clinic admins to update the linked union entity (branding, etc.)

DROP POLICY IF EXISTS "Clinic admins can update linked union entity" ON public.union_entities;

CREATE POLICY "Clinic admins can update linked union entity"
ON public.union_entities
FOR UPDATE
USING (
  clinic_id IS NOT NULL
  AND public.is_clinic_admin(auth.uid(), clinic_id)
)
WITH CHECK (
  clinic_id IS NOT NULL
  AND public.is_clinic_admin(auth.uid(), clinic_id)
);
