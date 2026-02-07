-- Add app availability settings to clinics table
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS app_unavailable boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS app_unavailable_message text,
ADD COLUMN IF NOT EXISTS app_unavailable_at timestamptz,
ADD COLUMN IF NOT EXISTS app_unavailable_by uuid;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.app_unavailable IS 'Whether the mobile app is currently unavailable for this clinic';
COMMENT ON COLUMN public.clinics.app_unavailable_message IS 'Custom message to show when app is unavailable';
COMMENT ON COLUMN public.clinics.app_unavailable_at IS 'When the app was marked as unavailable';
COMMENT ON COLUMN public.clinics.app_unavailable_by IS 'User who marked the app as unavailable';