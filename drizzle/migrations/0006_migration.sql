GRANT INSERT ON public.contribution_worker_list_validations TO authenticated;

CREATE POLICY "Clinic staff can add worker lists"
ON public.contribution_worker_list_validations FOR INSERT TO authenticated
WITH CHECK (
  portal_type = 'staff' AND portal_id = auth.uid()
  AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), clinic_id))
);

CREATE POLICY "Clinic staff can upload worker list files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'worker-lists'
  AND (storage.foldername(name))[1] = 'staff'
  AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), ((storage.foldername(name))[2])::uuid))
);