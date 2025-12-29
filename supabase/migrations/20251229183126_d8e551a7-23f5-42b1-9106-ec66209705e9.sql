-- Create panel_banners table for clinic-specific banners on public panel
CREATE TABLE public.panel_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT,
  subtitle TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  button_text TEXT,
  button_link TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  background_color TEXT DEFAULT '#1a1a2e',
  text_color TEXT DEFAULT '#ffffff',
  overlay_opacity NUMERIC DEFAULT 0.5,
  duration_seconds INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.panel_banners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for panel_banners
-- Public read for active banners (for public panel display)
CREATE POLICY "Anyone can view active panel banners"
ON public.panel_banners
FOR SELECT
USING (is_active = true);

-- Clinic admins can manage their own banners
CREATE POLICY "Clinic admins can insert panel banners"
ON public.panel_banners
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND clinic_id = panel_banners.clinic_id
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Clinic admins can update panel banners"
ON public.panel_banners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND clinic_id = panel_banners.clinic_id
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Clinic admins can delete panel banners"
ON public.panel_banners
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND clinic_id = panel_banners.clinic_id
    AND role IN ('owner', 'admin')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_panel_banners_updated_at
BEFORE UPDATE ON public.panel_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_panel_banners_clinic_active ON public.panel_banners(clinic_id, is_active);
CREATE INDEX idx_panel_banners_order ON public.panel_banners(clinic_id, order_index);