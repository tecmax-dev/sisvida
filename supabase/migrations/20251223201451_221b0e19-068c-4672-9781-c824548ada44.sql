-- Create smtp_settings table for email configuration
CREATE TABLE public.smtp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(500) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL DEFAULT 'Eclini',
  encryption VARCHAR(20) NOT NULL DEFAULT 'tls',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can view SMTP settings
CREATE POLICY "Super admins can view smtp_settings"
  ON public.smtp_settings
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Super admins can insert SMTP settings
CREATE POLICY "Super admins can insert smtp_settings"
  ON public.smtp_settings
  FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

-- Super admins can update SMTP settings
CREATE POLICY "Super admins can update smtp_settings"
  ON public.smtp_settings
  FOR UPDATE
  USING (is_super_admin(auth.uid()));

-- Super admins can delete SMTP settings
CREATE POLICY "Super admins can delete smtp_settings"
  ON public.smtp_settings
  FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_smtp_settings_updated_at
  BEFORE UPDATE ON public.smtp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();