CREATE TABLE IF NOT EXISTS public.whatsapp_meta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_template_id TEXT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  variables_count INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  quality_score TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

CREATE INDEX IF NOT EXISTS idx_meta_templates_status ON public.whatsapp_meta_templates(status);
CREATE INDEX IF NOT EXISTS idx_meta_templates_category ON public.whatsapp_meta_templates(category);

ALTER TABLE public.whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meta templates"
ON public.whatsapp_meta_templates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin'::app_role, 'owner'::app_role, 'entidade_sindical_admin'::app_role)
  )
);

CREATE POLICY "Admins can manage meta templates"
ON public.whatsapp_meta_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin'::app_role, 'owner'::app_role, 'entidade_sindical_admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin'::app_role, 'owner'::app_role, 'entidade_sindical_admin'::app_role)
  )
);

CREATE TRIGGER trg_meta_templates_updated_at
BEFORE UPDATE ON public.whatsapp_meta_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.whatsapp_tickets
ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_tickets_last_inbound ON public.whatsapp_tickets(last_inbound_at);