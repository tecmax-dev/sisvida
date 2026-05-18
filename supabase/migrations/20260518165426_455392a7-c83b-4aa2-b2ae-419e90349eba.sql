-- Compatibilidade com o app publicado: o bundle antigo ainda envia documentos para dependent-documents.
-- O bucket continua privado; esta política libera apenas a gravação do arquivo no padrão patientId/arquivo.

DROP POLICY IF EXISTS "Mobile app can upload dependent documents" ON storage.objects;

CREATE POLICY "Mobile app can upload dependent documents"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'dependent-documents'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Garantir que o bucket permaneça privado.
UPDATE storage.buckets
SET public = false
WHERE id = 'dependent-documents';