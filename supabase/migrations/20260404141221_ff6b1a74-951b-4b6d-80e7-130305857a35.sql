
-- Fix the view with correct column names
DROP VIEW IF EXISTS public.homologacao_availability;

CREATE OR REPLACE VIEW public.homologacao_availability
WITH (security_invoker = on) AS
  SELECT 
    id,
    clinic_id,
    professional_id,
    service_type_id,
    appointment_date,
    start_time,
    end_time,
    status,
    created_at
  FROM public.homologacao_appointments
  WHERE status <> 'cancelled';
