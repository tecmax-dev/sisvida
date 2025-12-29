-- Create storage bucket for panel banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('panel-banners', 'panel-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for panel banners
CREATE POLICY "Anyone can view panel banner images"
ON storage.objects FOR SELECT
USING (bucket_id = 'panel-banners');

CREATE POLICY "Clinic admins can upload panel banner images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'panel-banners' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Clinic admins can update panel banner images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'panel-banners' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Clinic admins can delete panel banner images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'panel-banners' AND
  auth.role() = 'authenticated'
);