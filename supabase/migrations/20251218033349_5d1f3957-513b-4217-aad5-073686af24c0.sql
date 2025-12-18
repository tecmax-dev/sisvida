-- 1. Add blocking fields to clinics table
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS blocked_reason text,
ADD COLUMN IF NOT EXISTS blocked_by uuid;

-- 2. Create Evolution API configurations per clinic
CREATE TABLE IF NOT EXISTS public.evolution_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  api_url text NOT NULL,
  api_key text NOT NULL,
  is_connected boolean DEFAULT false,
  connected_at timestamp with time zone,
  phone_number text,
  qr_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);

-- Enable RLS on evolution_configs
ALTER TABLE public.evolution_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for evolution_configs
CREATE POLICY "Clinic admins can view their evolution config" 
ON public.evolution_configs 
FOR SELECT 
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage their evolution config" 
ON public.evolution_configs 
FOR ALL 
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Super admins can view all evolution configs
CREATE POLICY "Super admins can view all evolution configs" 
ON public.evolution_configs 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- Create trigger to update updated_at
CREATE TRIGGER update_evolution_configs_updated_at
BEFORE UPDATE ON public.evolution_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add duration tracking to appointments (if not exists)
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS duration_minutes integer;