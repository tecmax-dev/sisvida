-- Drop the incorrect policy
DROP POLICY IF EXISTS "Clinic members can view payslips" ON storage.objects;

-- Recreate with correct reference to objects.name instead of clinics.name
CREATE POLICY "Clinic members can view payslips"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND has_clinic_access(auth.uid(), c.id)
      )
    )
  );

-- Also fix the delete policy that has the same bug
DROP POLICY IF EXISTS "Clinic admins can delete payslips" ON storage.objects;

CREATE POLICY "Clinic admins can delete payslips"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND is_clinic_admin(auth.uid(), c.id)
      )
    )
  );