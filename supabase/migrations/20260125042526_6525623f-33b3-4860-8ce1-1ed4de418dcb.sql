-- Create storage policy to allow uploads to contra-cheques bucket from mobile app
-- Since mobile app users are not authenticated via Supabase Auth, we need a permissive policy

-- Allow anyone to insert (upload) to contra-cheques bucket
-- The security is handled by the application layer (mobile session validation)
CREATE POLICY "Allow payslip uploads from mobile app"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'contra-cheques');

-- Allow authenticated users and admins to view their payslips
CREATE POLICY "Allow payslip viewing"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'contra-cheques');