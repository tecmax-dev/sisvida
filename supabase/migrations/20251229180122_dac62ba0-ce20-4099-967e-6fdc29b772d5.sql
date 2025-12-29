-- Create carousel_banners table for landing page banners
CREATE TABLE public.carousel_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  button_text TEXT,
  button_link TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  background_color TEXT,
  text_color TEXT,
  overlay_opacity NUMERIC DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.carousel_banners ENABLE ROW LEVEL SECURITY;

-- Public read policy for active banners
CREATE POLICY "Anyone can view active banners"
ON public.carousel_banners
FOR SELECT
USING (is_active = true);

-- Super admins can manage all banners
CREATE POLICY "Super admins can manage banners"
ON public.carousel_banners
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_carousel_banners_updated_at
BEFORE UPDATE ON public.carousel_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample banners
INSERT INTO public.carousel_banners (title, subtitle, description, image_url, button_text, button_link, order_index, background_color, text_color) VALUES
('Gestão Completa para sua Clínica', 'Sistema de agendamento inteligente', 'Automatize sua rotina e foque no que realmente importa: seus pacientes.', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&q=80', 'Começar Agora', '#pricing', 0, '#0f172a', '#ffffff'),
('Telemedicina Integrada', 'Consultas online com segurança', 'Atenda seus pacientes de qualquer lugar com nossa plataforma segura.', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1920&q=80', 'Saiba Mais', '#features', 1, '#1e3a5f', '#ffffff'),
('Prontuário Eletrônico', 'Histórico completo do paciente', 'Acesse todas as informações do paciente em um único lugar.', 'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=1920&q=80', 'Ver Recursos', '#features', 2, '#0d9488', '#ffffff');