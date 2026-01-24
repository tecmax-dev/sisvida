-- Create first_access_tokens table
CREATE TABLE IF NOT EXISTS public.first_access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.first_access_tokens ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_first_access_tokens_email ON public.first_access_tokens(email);
CREATE INDEX IF NOT EXISTS idx_first_access_tokens_token ON public.first_access_tokens(token);

-- RLS policy - only accessible via service role (edge functions)
CREATE POLICY "Service role only" ON public.first_access_tokens
  FOR ALL USING (false);

COMMENT ON TABLE public.first_access_tokens IS 'Stores temporary tokens for first-time app access password setup';