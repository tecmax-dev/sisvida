-- Tabela para rastrear instalações do PWA
CREATE TABLE public.pwa_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  device_info JSONB DEFAULT '{}',
  user_agent TEXT,
  platform TEXT,
  installed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  referrer TEXT,
  standalone BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_pwa_installations_clinic_id ON public.pwa_installations(clinic_id);
CREATE INDEX idx_pwa_installations_installed_at ON public.pwa_installations(installed_at DESC);
CREATE INDEX idx_pwa_installations_platform ON public.pwa_installations(platform);

-- RLS
ALTER TABLE public.pwa_installations ENABLE ROW LEVEL SECURITY;

-- Política para permitir INSERT anônimo (rastreamento de instalações)
CREATE POLICY "Allow anonymous insert for PWA tracking"
  ON public.pwa_installations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Política para leitura apenas por usuários autenticados com acesso à clínica
CREATE POLICY "Users can view PWA installations for their clinics"
  ON public.pwa_installations
  FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (SELECT get_user_clinic_ids(auth.uid()))
    OR is_super_admin(auth.uid())
  );

-- Comentários
COMMENT ON TABLE public.pwa_installations IS 'Histórico de instalações do PWA do app mobile';
COMMENT ON COLUMN public.pwa_installations.device_info IS 'Informações do dispositivo em JSON';
COMMENT ON COLUMN public.pwa_installations.standalone IS 'Se foi instalado como app standalone';