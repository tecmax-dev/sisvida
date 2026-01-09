-- Add photo_url column to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage bucket for patient photos (public for card display)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view patient photos (needed for public card validation)
CREATE POLICY "Anyone can view patient photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'patient-photos');

-- Policy: Authenticated users can upload patient photos
CREATE POLICY "Authenticated users can upload patient photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'patient-photos');

-- Policy: Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update patient photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'patient-photos');

-- Policy: Authenticated users can delete patient photos
CREATE POLICY "Authenticated users can delete patient photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'patient-photos');