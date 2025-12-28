-- Create hero_settings table for dynamic hero configuration
CREATE TABLE public.hero_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Sistema de Gestão para Clínicas',
  subtitle TEXT NOT NULL DEFAULT 'A plataforma completa para gestão da sua clínica',
  description TEXT,
  primary_button_text TEXT DEFAULT 'Começar Grátis',
  primary_button_link TEXT DEFAULT '/auth',
  secondary_button_text TEXT DEFAULT 'Ver Preços',
  secondary_button_link TEXT DEFAULT '#pricing',
  highlights JSONB DEFAULT '["Agenda inteligente", "Prontuário eletrônico", "Financeiro completo", "WhatsApp integrado"]'::jsonb,
  hero_image_url TEXT,
  background_effect TEXT DEFAULT 'gradient',
  show_floating_badges BOOLEAN DEFAULT true,
  show_social_proof BOOLEAN DEFAULT true,
  social_proof_users INTEGER DEFAULT 2500,
  social_proof_rating DECIMAL DEFAULT 4.9,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hero_settings ENABLE ROW LEVEL SECURITY;

-- Policy for public read access (landing page needs to read)
CREATE POLICY "Hero settings are publicly readable"
ON public.hero_settings
FOR SELECT
USING (true);

-- Policy for super admin write access
CREATE POLICY "Super admins can manage hero settings"
ON public.hero_settings
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_hero_settings_updated_at
BEFORE UPDATE ON public.hero_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default hero settings
INSERT INTO public.hero_settings (
  title,
  subtitle,
  description,
  highlights,
  background_effect
) VALUES (
  'Sistema de Gestão para Clínicas',
  'A plataforma completa para gestão da sua clínica',
  'Simplifique sua rotina com agenda inteligente, prontuário eletrônico, financeiro integrado e WhatsApp automatizado.',
  '["Agenda inteligente", "Prontuário eletrônico", "Financeiro completo", "WhatsApp integrado"]'::jsonb,
  'gradient'
);