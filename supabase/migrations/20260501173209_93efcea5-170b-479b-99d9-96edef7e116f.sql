CREATE TABLE IF NOT EXISTS public.zapster_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  phone_number TEXT,
  webhook_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ,
  last_status_check TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zapster_configs_instance_id ON public.zapster_configs (instance_id);
CREATE INDEX IF NOT EXISTS idx_zapster_configs_clinic ON public.zapster_configs (clinic_id);

ALTER TABLE public.zapster_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic admins can view zapster config"
ON public.zapster_configs FOR SELECT TO authenticated
USING (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
);

CREATE POLICY "Clinic admins can insert zapster config"
ON public.zapster_configs FOR INSERT TO authenticated
WITH CHECK (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
);

CREATE POLICY "Clinic admins can update zapster config"
ON public.zapster_configs FOR UPDATE TO authenticated
USING (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
);

CREATE POLICY "Clinic admins can delete zapster config"
ON public.zapster_configs FOR DELETE TO authenticated
USING (
  public.is_clinic_admin(auth.uid(), clinic_id)
  OR EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
);

CREATE TRIGGER trg_zapster_configs_updated_at
BEFORE UPDATE ON public.zapster_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();