-- Add 'in_progress' status to appointment_status enum
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'in_progress';

-- Add started_at and completed_at timestamps to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;