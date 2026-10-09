CREATE POLICY "Clinic staff upload affiliation files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'affiliation-documents' AND public.has_clinic_access(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Clinic staff read affiliation files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'affiliation-documents' AND public.has_clinic_access(auth.uid(), ((storage.foldername(name))[1])::uuid));