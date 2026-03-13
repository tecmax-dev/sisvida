-- Create storage bucket for WhatsApp guide images
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-assets', 'whatsapp-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for whatsapp-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-assets');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload whatsapp-assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-assets' AND auth.role() = 'authenticated');