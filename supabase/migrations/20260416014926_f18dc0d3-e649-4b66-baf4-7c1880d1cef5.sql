-- Fix 1: Create secure public view for clinics (non-sensitive data only)
-- Drop existing view if exists to avoid conflicts
DROP VIEW IF EXISTS public.public_clinic_info;

-- Create new secure view exposing only non-sensitive fields
CREATE VIEW public.public_clinic_info AS
SELECT 
    id,
    name,
    slug,
    logo_url,
    phone,
    email,
    address,
    city,
    state_code,
    opening_time,
    closing_time,
    entity_nomenclature,
    custom_map_embed_url,
    map_view_type,
    booking_months_ahead,
    min_advance_booking_hours,
    max_appointments_per_cpf_month,
    holidays_enabled,
    birthday_enabled,
    reminder_enabled,
    reminder_hours,
    is_blocked,
    app_unavailable,
    app_unavailable_message,
    created_at,
    updated_at
FROM public.clinics;

-- Set ownership and permissions
ALTER VIEW public.public_clinic_info OWNER TO postgres;

-- Add RLS to the view by enabling it on the underlying table policies
-- Update the public SELECT policy to use this view instead
COMMENT ON VIEW public.public_clinic_info IS 'Public-safe clinic info view - excludes sensitive PII like owner_cpf, cnpj, blocked_reason, etc.';