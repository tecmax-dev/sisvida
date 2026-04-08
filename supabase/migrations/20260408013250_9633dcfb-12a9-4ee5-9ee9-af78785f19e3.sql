
-- Fix patient-photos bucket: make it public for photo display on cards, member lists, etc.
UPDATE storage.buckets SET public = true WHERE id = 'patient-photos';

-- Fix: Replace overly permissive SELECT policy on patient-photos with authenticated-only
DROP POLICY IF EXISTS "Anyone can view patient photos" ON storage.objects;
CREATE POLICY "Authenticated can view patient photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'patient-photos');

-- Also allow public SELECT for patient photos (needed for cards, public member portal)
CREATE POLICY "Public can view patient photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'patient-photos');

-- Fix: Restrict dependent-documents uploads to authenticated users only
DROP POLICY IF EXISTS "Anyone can upload dependent documents" ON storage.objects;
CREATE POLICY "Authenticated can upload dependent documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dependent-documents');

-- Fix: Restrict dependent-documents SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view dependent documents" ON storage.objects;
CREATE POLICY "Authenticated can view dependent documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dependent-documents');
