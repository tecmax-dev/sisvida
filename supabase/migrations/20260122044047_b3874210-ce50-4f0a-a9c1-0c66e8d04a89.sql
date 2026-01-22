-- Add logo and president signature fields to union_entities
ALTER TABLE public.union_entities 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS president_name TEXT,
ADD COLUMN IF NOT EXISTS president_signature_url TEXT;

-- Create storage bucket for union entity files if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('union-entity-files', 'union-entity-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their entity's folder
CREATE POLICY "Users can upload union entity files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'union-entity-files'
);

-- Allow public read access
CREATE POLICY "Public can view union entity files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'union-entity-files');

-- Allow authenticated users to update their files
CREATE POLICY "Users can update union entity files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'union-entity-files');

-- Allow authenticated users to delete their files
CREATE POLICY "Users can delete union entity files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'union-entity-files');