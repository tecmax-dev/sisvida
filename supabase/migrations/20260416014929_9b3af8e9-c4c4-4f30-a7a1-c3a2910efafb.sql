-- Fix 2: Create secure public view for professionals (non-sensitive data only)
DROP VIEW IF EXISTS public.public_professionals;

CREATE VIEW public.public_professionals AS
SELECT 
    id,
    clinic_id,
    name,
    specialty,
    avatar_url,
    bio,
    slug,
    is_active,
    created_at,
    updated_at
    -- Excludes: phone, email, whatsapp, cpf, rg, address, emergency_contact
FROM public.professionals
WHERE is_active = true;

ALTER VIEW public.public_professionals OWNER TO postgres;

COMMENT ON VIEW public.public_professionals IS 'Public-safe professionals view - excludes PII like phone, email, whatsapp, CPF, RG';