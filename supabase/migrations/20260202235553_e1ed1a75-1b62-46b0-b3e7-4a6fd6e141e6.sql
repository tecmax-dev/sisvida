-- Tabela para avisos pop-up do sindicato
CREATE TABLE public.popup_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  image_url TEXT,
  button_text TEXT DEFAULT 'Entendi',
  button_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_once_per_session BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.popup_notices ENABLE ROW LEVEL SECURITY;

-- Policy for reading active notices (public for mobile app)
CREATE POLICY "Anyone can view active popup notices"
ON public.popup_notices
FOR SELECT
USING (
  is_active = true 
  AND (starts_at IS NULL OR starts_at <= now())
  AND (expires_at IS NULL OR expires_at > now())
);

-- Policy for admin management
CREATE POLICY "Clinic users can manage popup notices"
ON public.popup_notices
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.clinic_id = popup_notices.clinic_id
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_popup_notices_updated_at
BEFORE UPDATE ON public.popup_notices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_popup_notices_active ON public.popup_notices(clinic_id, is_active, priority DESC);

COMMENT ON TABLE public.popup_notices IS 'Avisos pop-up que aparecem ao abrir o app mobile';
COMMENT ON COLUMN public.popup_notices.show_once_per_session IS 'Se true, mostra apenas uma vez por sessão do usuário';
COMMENT ON COLUMN public.popup_notices.priority IS 'Maior prioridade aparece primeiro';