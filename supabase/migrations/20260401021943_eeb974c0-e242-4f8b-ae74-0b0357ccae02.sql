-- =====================================================
-- BATCH 2: Fix token-based policies
-- =====================================================

-- 6. ANAMNESE_RESPONSES: Fix always-true token policy
DROP POLICY IF EXISTS "Public can view anamnesis via token" ON public.anamnese_responses;
DROP POLICY IF EXISTS "Public can update anamnesis via token" ON public.anamnese_responses;

-- Create RPC function for public token-based access instead
CREATE OR REPLACE FUNCTION public.get_anamnese_by_token(p_token uuid)
RETURNS SETOF public.anamnese_responses
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.anamnese_responses
  WHERE public_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_anamnese_by_token(
  p_token uuid,
  p_signature_data text DEFAULT NULL,
  p_signed_at timestamptz DEFAULT NULL,
  p_responsibility_accepted boolean DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.anamnese_responses
  SET 
    signature_data = COALESCE(p_signature_data, signature_data),
    signed_at = COALESCE(p_signed_at, signed_at),
    responsibility_accepted = COALESCE(p_responsibility_accepted, responsibility_accepted),
    updated_at = now()
  WHERE public_token = p_token;
  RETURN FOUND;
END;
$$;

-- 7. SIGNATURE_REQUEST_TOKENS: Fix fully open SELECT
DROP POLICY IF EXISTS "Anyone can view by token" ON public.signature_request_tokens;

-- Create RPC for token lookup
CREATE OR REPLACE FUNCTION public.get_signature_token(p_token text)
RETURNS SETOF public.signature_request_tokens
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.signature_request_tokens
  WHERE token = p_token AND used_at IS NULL
  LIMIT 1;
$$;

-- 8. TELEMEDICINE_SESSIONS: Fix always-true token policy
DROP POLICY IF EXISTS "Public can view session by patient token" ON public.telemedicine_sessions;
DROP POLICY IF EXISTS "Public can update session by patient token" ON public.telemedicine_sessions;

-- Create RPC for patient token access
CREATE OR REPLACE FUNCTION public.get_telemedicine_by_patient_token(p_token uuid)
RETURNS SETOF public.telemedicine_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.telemedicine_sessions
  WHERE patient_token = p_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.update_telemedicine_by_patient_token(
  p_token uuid,
  p_status text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.telemedicine_sessions
  SET 
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE patient_token = p_token;
  RETURN FOUND;
END;
$$;

-- 9. EMPLOYER_CONTRIBUTIONS: Fix always-true token policy
DROP POLICY IF EXISTS "Public can view contributions by token" ON public.employer_contributions;

-- Create RPC for token-based access
CREATE OR REPLACE FUNCTION public.get_contribution_by_token(p_token text)
RETURNS SETOF public.employer_contributions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.employer_contributions
  WHERE public_access_token = p_token
  LIMIT 1;
$$;

-- 10. NEGOTIATION_PREVIEWS: Fix time-only policy
DROP POLICY IF EXISTS "Public can view previews with valid token" ON public.negotiation_previews;

-- Create RPC for token-based access
CREATE OR REPLACE FUNCTION public.get_negotiation_preview_by_token(p_token text)
RETURNS SETOF public.negotiation_previews
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.negotiation_previews
  WHERE access_token = p_token
    AND expires_at > now()
    AND (is_cancelled IS NULL OR is_cancelled = false)
  LIMIT 1;
$$;

-- 11. MEMBER_CONTRIBUTIONS: Fix fully open SELECT
DROP POLICY IF EXISTS "Allow public select for member contributions portal" ON public.member_contributions;