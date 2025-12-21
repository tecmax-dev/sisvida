-- Create storage bucket for carousel images
INSERT INTO storage.buckets (id, name, public)
VALUES ('carousel-images', 'carousel-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to carousel images
CREATE POLICY "Public read access for carousel images"
ON storage.objects FOR SELECT
USING (bucket_id = 'carousel-images');

-- Allow authenticated users to upload carousel images
CREATE POLICY "Authenticated users can upload carousel images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'carousel-images');