-- Replace partial unique index with a standard unique index so ON CONFLICT (appointment_id) works
DROP INDEX IF EXISTS public.medical_records_unique_appointment_id;
CREATE UNIQUE INDEX IF NOT EXISTS medical_records_unique_appointment_id
ON public.medical_records (appointment_id);