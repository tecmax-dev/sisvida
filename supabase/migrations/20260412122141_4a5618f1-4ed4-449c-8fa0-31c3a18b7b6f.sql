
-- Revert: patient-photos needs to be public for display across the app
UPDATE storage.buckets SET public = true WHERE id = 'patient-photos';
