
-- Bucket público para imagens de campanhas de email
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas: leitura pública, upload por authenticated e service_role
DROP POLICY IF EXISTS "Public read email-assets" ON storage.objects;
CREATE POLICY "Public read email-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "Authenticated upload email-assets" ON storage.objects;
CREATE POLICY "Authenticated upload email-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "Authenticated update email-assets" ON storage.objects;
CREATE POLICY "Authenticated update email-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'email-assets');

DROP POLICY IF EXISTS "Authenticated delete email-assets" ON storage.objects;
CREATE POLICY "Authenticated delete email-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'email-assets');
