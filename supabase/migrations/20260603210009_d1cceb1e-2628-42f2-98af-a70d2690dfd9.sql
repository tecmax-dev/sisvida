DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;

CREATE OR REPLACE FUNCTION public.can_access_chat_attachment(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversations c
    WHERE c.id::text = (storage.foldername(object_name))[1]
      AND (
        c.user_id = auth.uid()
        OR public.has_clinic_access(auth.uid(), c.clinic_id)
        OR public.is_super_admin(auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_legal_document(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.union_legal_case_documents d
      JOIN public.union_legal_cases lc ON lc.id = d.legal_case_id
      WHERE d.storage_path = object_name
        AND public.has_clinic_access(auth.uid(), lc.clinic_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.union_legal_cases lc
      WHERE lc.clinic_id::text = (storage.foldername(object_name))[1]
        AND lc.id::text = (storage.foldername(object_name))[2]
        AND public.has_clinic_access(auth.uid(), lc.clinic_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_chat_attachment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_legal_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_attachment(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_legal_document(text) TO service_role;

DROP POLICY IF EXISTS "Users can upload to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their conversation attachments" ON storage.objects;

CREATE POLICY "Users can upload scoped conversation attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.can_access_chat_attachment(name)
);

CREATE POLICY "Users can view scoped conversation attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.can_access_chat_attachment(name)
);

DROP POLICY IF EXISTS legal_docs_insert ON storage.objects;
DROP POLICY IF EXISTS legal_docs_select ON storage.objects;
DROP POLICY IF EXISTS legal_docs_update ON storage.objects;

CREATE POLICY legal_docs_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'legal-documents'
  AND public.can_access_legal_document(name)
);

CREATE POLICY legal_docs_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'legal-documents'
  AND public.can_access_legal_document(name)
);

CREATE POLICY legal_docs_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'legal-documents'
  AND public.can_access_legal_document(name)
)
WITH CHECK (
  bucket_id = 'legal-documents'
  AND public.can_access_legal_document(name)
);