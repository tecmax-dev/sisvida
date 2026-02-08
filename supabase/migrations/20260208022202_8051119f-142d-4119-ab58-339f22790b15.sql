-- Create table to store signature request tokens
CREATE TABLE public.signature_request_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  associado_id UUID NOT NULL REFERENCES public.sindical_associados(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT
);

-- Add indexes for performance
CREATE INDEX idx_signature_tokens_token ON public.signature_request_tokens(token);
CREATE INDEX idx_signature_tokens_associado ON public.signature_request_tokens(associado_id);
CREATE INDEX idx_signature_tokens_clinic ON public.signature_request_tokens(clinic_id);
CREATE INDEX idx_signature_tokens_expires ON public.signature_request_tokens(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.signature_request_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Authenticated users with clinic access can view tokens
CREATE POLICY "Clinic users can view tokens" ON public.signature_request_tokens
  FOR SELECT USING (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- Authenticated users with clinic access can create tokens
CREATE POLICY "Clinic users can create tokens" ON public.signature_request_tokens
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT ur.clinic_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- Anonymous users can view tokens by token value (for public signature page)
CREATE POLICY "Anyone can view by token" ON public.signature_request_tokens
  FOR SELECT USING (true);

-- Function to generate secure token
CREATE OR REPLACE FUNCTION public.generate_signature_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Add comment
COMMENT ON TABLE public.signature_request_tokens IS 'Tokens for digital signature requests sent via email to union members';