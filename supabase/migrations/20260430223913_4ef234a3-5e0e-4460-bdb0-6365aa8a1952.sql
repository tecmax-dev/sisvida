-- Create zapresponder_configs table
CREATE TABLE IF NOT EXISTS public.zapresponder_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Padrão',
    api_token TEXT NOT NULL,
    instance_id TEXT, -- Optional depending on how Zap Responder identifies the account
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.zapresponder_configs ENABLE ROW LEVEL SECURITY;

-- Simple policy: only authenticated users can read/write for now
-- (Adjust this later based on specific role requirements if needed)
CREATE POLICY "Enable all for authenticated users" 
ON public.zapresponder_configs 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_zapresponder_configs_updated_at
BEFORE UPDATE ON public.zapresponder_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();