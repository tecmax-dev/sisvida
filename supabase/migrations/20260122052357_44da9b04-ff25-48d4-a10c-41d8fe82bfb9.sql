-- Fix RLS policies for union-entity-files bucket to require authentication

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload union entity files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update union entity files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete union entity files" ON storage.objects;

-- Recreate with proper authentication checks
CREATE POLICY "Authenticated users can upload union entity files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'union-entity-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update union entity files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'union-entity-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete union entity files"
ON storage.objects FOR DELETE
USING (bucket_id = 'union-entity-files' AND auth.role() = 'authenticated');