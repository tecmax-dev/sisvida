-- Create table for Twilio WhatsApp configuration per clinic
CREATE TABLE public.twilio_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  account_sid TEXT NOT NULL,
  auth_token TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);

-- Enable RLS
ALTER TABLE public.twilio_configs ENABLE ROW LEVEL SECURITY;

-- Policies using existing helper functions
CREATE POLICY "Clinic admins can view their Twilio config"
  ON public.twilio_configs
  FOR SELECT
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage their Twilio config"
  ON public.twilio_configs
  FOR ALL
  USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Super admins can manage all Twilio configs"
  ON public.twilio_configs
  FOR ALL
  USING (is_super_admin(auth.uid()));

-- Add whatsapp_provider column to clinics table to track which provider to use
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT DEFAULT 'evolution';

-- Create trigger for updated_at
CREATE TRIGGER update_twilio_configs_updated_at
  BEFORE UPDATE ON public.twilio_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();