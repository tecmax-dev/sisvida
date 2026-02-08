-- Add signature fields to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS signature_accepted_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the fields
COMMENT ON COLUMN public.patients.signature_url IS 'URL da assinatura digital do sócio';
COMMENT ON COLUMN public.patients.signature_accepted IS 'Indica se o sócio aceitou o desconto em folha';
COMMENT ON COLUMN public.patients.signature_accepted_at IS 'Data/hora da assinatura';