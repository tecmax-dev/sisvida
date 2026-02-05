-- Make sindical-documentos bucket public for viewing documents
UPDATE storage.buckets 
SET public = true 
WHERE id = 'sindical-documentos';

-- Create policy to allow public read access
CREATE POLICY "Allow public read access to sindical-documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'sindical-documentos');

-- Ensure authenticated users can still upload
CREATE POLICY "Allow authenticated uploads to sindical-documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sindical-documentos');

-- Allow anon users to upload (for public filiation form)
CREATE POLICY "Allow anon uploads to sindical-documentos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'sindical-documentos');