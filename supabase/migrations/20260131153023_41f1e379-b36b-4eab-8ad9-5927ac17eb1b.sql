-- Create a table to store mobile app settings including session invalidation
CREATE TABLE IF NOT EXISTS public.mobile_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  force_logout_after TIMESTAMPTZ,
  min_app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id)
);

-- Enable RLS
ALTER TABLE public.mobile_app_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings (needed for logout check)
CREATE POLICY "Anyone can read mobile app settings"
ON public.mobile_app_settings FOR SELECT
USING (true);

-- Only admins can update (we'll use service role for now)
CREATE POLICY "Service role can manage mobile app settings"
ON public.mobile_app_settings FOR ALL
USING (auth.role() = 'service_role');

-- Insert settings for all existing clinics with force_logout_after = NOW to invalidate all sessions
INSERT INTO public.mobile_app_settings (clinic_id, force_logout_after)
SELECT id, now() FROM public.clinics
ON CONFLICT (clinic_id) DO UPDATE SET force_logout_after = now(), updated_at = now();

-- Also clear all push notification tokens to force re-registration with OneSignal
UPDATE public.push_notification_tokens 
SET is_active = false 
WHERE device_info->>'platform' = 'web' OR device_info->>'type' LIKE '%web%';