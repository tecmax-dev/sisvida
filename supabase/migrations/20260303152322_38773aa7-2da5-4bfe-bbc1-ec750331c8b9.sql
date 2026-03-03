
-- Add session policy column to clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS allow_multiple_sessions boolean NOT NULL DEFAULT true;

-- Create table to track active user sessions
CREATE TABLE public.user_active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  session_token text NOT NULL,
  device_info text,
  ip_address text,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  invalidated_at timestamptz,
  invalidated_reason text
);

-- Index for fast lookups
CREATE INDEX idx_user_active_sessions_user_clinic ON public.user_active_sessions(user_id, clinic_id, is_active);
CREATE INDEX idx_user_active_sessions_token ON public.user_active_sessions(session_token);

-- Enable RLS
ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: users can see their own sessions, admins can see all in their clinic
CREATE POLICY "Users can view own sessions"
  ON public.user_active_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users can insert own sessions"
  ON public.user_active_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON public.user_active_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

-- Function to invalidate previous sessions
CREATE OR REPLACE FUNCTION public.invalidate_previous_sessions(p_user_id uuid, p_clinic_id uuid, p_current_session_token text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invalidated_count integer;
BEGIN
  UPDATE public.user_active_sessions
  SET is_active = false,
      invalidated_at = now(),
      invalidated_reason = 'new_login'
  WHERE user_id = p_user_id
    AND clinic_id = p_clinic_id
    AND is_active = true
    AND session_token != p_current_session_token;
  
  GET DIAGNOSTICS invalidated_count = ROW_COUNT;
  RETURN invalidated_count;
END;
$$;

-- Function to check if session is still valid
CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_active_sessions
    WHERE session_token = p_session_token
      AND is_active = true
  );
$$;
