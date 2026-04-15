
-- Helper function to check if user has access to the clinic referenced in the storage path
CREATE OR REPLACE FUNCTION public.user_has_clinic_storage_access(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_clinic_access(auth.uid(), (storage.foldername(object_name))[1]::uuid)
$$;

-- ============================================
-- Fix union-app-content bucket policies
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload union app content" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update union app content files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete union app content files" ON storage.objects;

-- New INSERT policy: clinic-scoped
CREATE POLICY "Clinic members can upload union app content"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'union-app-content'
  AND auth.role() = 'authenticated'
  AND public.user_has_clinic_storage_access(name)
);

-- New UPDATE policy: clinic-scoped
CREATE POLICY "Clinic members can update union app content"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'union-app-content'
  AND auth.role() = 'authenticated'
  AND public.user_has_clinic_storage_access(name)
);

-- New DELETE policy: clinic-scoped
CREATE POLICY "Clinic members can delete union app content"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'union-app-content'
  AND auth.role() = 'authenticated'
  AND public.user_has_clinic_storage_access(name)
);

-- ============================================
-- Fix union-entity-files bucket policies
-- ============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload union entity files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update union entity files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete union entity files" ON storage.objects;

-- New INSERT policy: clinic-scoped via entity path
CREATE POLICY "Clinic members can upload union entity files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'union-entity-files'
  AND auth.role() = 'authenticated'
  AND public.user_has_clinic_storage_access(name)
);

-- New UPDATE policy: clinic-scoped
CREATE POLICY "Clinic members can update union entity files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'union-entity-files'
  AND auth.role() = 'authenticated'
  AND public.user_has_clinic_storage_access(name)
);

-- New DELETE policy: clinic-scoped
CREATE POLICY "Clinic members can delete union entity files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'union-entity-files'
  AND auth.role() = 'authenticated'
  AND public.user_has_clinic_storage_access(name)
);
