-- Drop the existing restrictive policy for viewing payslips
DROP POLICY IF EXISTS "Clinic admins can view payslips" ON storage.objects;

-- Create new policy that allows any clinic member to view payslips
CREATE POLICY "Clinic members can view payslips"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'contra-cheques'
    AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id::text = (storage.foldername(name))[1]
        AND has_clinic_access(auth.uid(), c.id)
      )
    )
  );