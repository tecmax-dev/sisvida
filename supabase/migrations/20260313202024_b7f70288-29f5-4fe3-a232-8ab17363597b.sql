-- Allow authenticated patients to insert homologacao appointments from mobile PWA
CREATE POLICY "authenticated_users_can_insert_homologacao_appointments"
ON public.homologacao_appointments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Drop the old restrictive insert policy since the new one covers all authenticated users
DROP POLICY IF EXISTS "insert_homologacao_appointments_by_clinic_access" ON public.homologacao_appointments;