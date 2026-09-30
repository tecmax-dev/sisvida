CREATE POLICY "Clinic staff can read worker list files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'worker-lists' AND (
    public.is_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.contribution_worker_list_validations v
      WHERE v.file_path = storage.objects.name
        AND public.has_clinic_access(auth.uid(), v.clinic_id)
    )
  )
);