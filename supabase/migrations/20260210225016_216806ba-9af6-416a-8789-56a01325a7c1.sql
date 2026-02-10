-- Make dependent-documents bucket public so public URLs work
UPDATE storage.buckets SET public = true WHERE id = 'dependent-documents';

-- Ensure public SELECT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Public read dependent-documents'
  ) THEN
    CREATE POLICY "Public read dependent-documents"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'dependent-documents');
  END IF;
END $$;