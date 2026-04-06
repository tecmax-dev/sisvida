-- Drop the broken policy
DROP POLICY IF EXISTS "Authenticated clinic members can upload payslips" ON storage.objects;

-- Create a correct policy: path is clinicId/patientId/file, so foldername[1] = clinicId
CREATE POLICY "Authenticated clinic members can upload payslips"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contra-cheques'
  AND (
    is_super_admin(auth.uid())
    OR has_clinic_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);