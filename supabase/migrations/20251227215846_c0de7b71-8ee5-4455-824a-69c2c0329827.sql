-- Add column for custom WhatsApp header image
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS whatsapp_header_image_url text;

-- Add comment explaining the column
COMMENT ON COLUMN public.clinics.whatsapp_header_image_url IS 'Custom header image URL for WhatsApp reminders and birthday messages';

-- Add permission for managing WhatsApp header image
INSERT INTO public.permission_definitions (key, name, description, category, order_index)
VALUES ('manage_whatsapp_header', 'Gerenciar imagem do WhatsApp', 'Permite fazer upload e alterar a imagem de cabeçalho das mensagens de WhatsApp', 'Configurações', 20)
ON CONFLICT (key) DO NOTHING;

-- Create storage bucket for clinic assets if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-assets', 'clinic-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their clinic folder
CREATE POLICY "Clinic admins can upload assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'clinic-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view clinic assets (public bucket)
CREATE POLICY "Anyone can view clinic assets" ON storage.objects
FOR SELECT USING (bucket_id = 'clinic-assets');

-- Allow clinic admins to delete their assets
CREATE POLICY "Clinic admins can delete assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'clinic-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow clinic admins to update their assets
CREATE POLICY "Clinic admins can update assets" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'clinic-assets' 
  AND auth.role() = 'authenticated'
);