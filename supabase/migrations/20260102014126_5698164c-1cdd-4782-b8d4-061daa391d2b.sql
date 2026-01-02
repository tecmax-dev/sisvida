-- Add missing column for storing available insurance plans in session
ALTER TABLE public.whatsapp_booking_sessions 
ADD COLUMN IF NOT EXISTS available_insurance_plans JSONB;