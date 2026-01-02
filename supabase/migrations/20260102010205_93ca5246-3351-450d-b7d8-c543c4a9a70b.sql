-- Fix foreign key constraint to allow patient deletion
-- Sessions are temporary, so we set patient_id to NULL when patient is deleted

ALTER TABLE public.whatsapp_booking_sessions
DROP CONSTRAINT IF EXISTS whatsapp_booking_sessions_patient_id_fkey;

ALTER TABLE public.whatsapp_booking_sessions
ADD CONSTRAINT whatsapp_booking_sessions_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;