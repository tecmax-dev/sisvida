-- Create table for mobile app tab settings
CREATE TABLE public.mobile_app_tabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_key VARCHAR(50) NOT NULL UNIQUE,
  tab_name VARCHAR(100) NOT NULL,
  tab_category VARCHAR(50) NOT NULL DEFAULT 'services',
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mobile_app_tabs ENABLE ROW LEVEL SECURITY;

-- Public read access for app
CREATE POLICY "Anyone can view active tabs"
ON public.mobile_app_tabs
FOR SELECT
USING (true);

-- Admin update access
CREATE POLICY "Authenticated users can update tabs"
ON public.mobile_app_tabs
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Insert default tabs
INSERT INTO public.mobile_app_tabs (tab_key, tab_name, tab_category, order_index, is_active) VALUES
-- Featured Services (quick access)
('dependentes', 'Dependentes', 'featured', 1, true),
('alterar-senha', 'Alterar Senha', 'featured', 2, true),
('carteirinha', 'Carteirinha', 'featured', 3, true),
-- Main Services Grid
('agendamentos', 'Agendamentos', 'services', 1, true),
('convencoes', 'Convenções', 'services', 2, true),
('declaracoes', 'Declarações', 'services', 3, true),
('convenios', 'Convênios', 'services', 4, true),
('boletos', 'Boletos', 'services', 5, true),
('diretoria', 'Diretoria', 'services', 6, true),
('documentos', 'Documentos', 'services', 7, true),
('atendimentos', 'Atendimentos', 'services', 8, true),
('ouvidoria', 'Ouvidoria', 'services', 9, true),
-- Communication
('galeria', 'Galeria', 'communication', 1, true),
('jornais', 'Jornais', 'communication', 2, true),
('radios', 'Rádios', 'communication', 3, true),
('videos', 'Vídeos', 'communication', 4, true);

-- Create updated_at trigger
CREATE TRIGGER update_mobile_app_tabs_updated_at
BEFORE UPDATE ON public.mobile_app_tabs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();