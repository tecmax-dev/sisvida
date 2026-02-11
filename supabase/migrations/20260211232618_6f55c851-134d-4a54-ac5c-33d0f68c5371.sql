
-- Create a public bucket for WhatsApp header images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-headers', 'whatsapp-headers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for whatsapp headers"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-headers');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload whatsapp headers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-headers' AND auth.role() = 'authenticated');
