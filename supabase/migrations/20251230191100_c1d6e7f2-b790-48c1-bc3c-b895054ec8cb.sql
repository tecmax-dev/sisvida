-- Create global_config table for system-wide settings
CREATE TABLE public.global_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/write global config
CREATE POLICY "Super admins can manage global config"
ON public.global_config
FOR ALL
USING (is_super_admin(auth.uid()));

-- Insert default row
INSERT INTO public.global_config (evolution_api_url, evolution_api_key)
VALUES (NULL, NULL);