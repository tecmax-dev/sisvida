-- Add slot tracking columns to waiting_list
ALTER TABLE public.waiting_list 
  ADD COLUMN IF NOT EXISTS notification_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS offered_appointment_date date,
  ADD COLUMN IF NOT EXISTS offered_appointment_time text,
  ADD COLUMN IF NOT EXISTS offered_professional_id uuid REFERENCES public.professionals(id),
  ADD COLUMN IF NOT EXISTS offered_professional_name text,
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.waiting_list.notification_status IS 'pending | notified | confirmed | declined | skipped';