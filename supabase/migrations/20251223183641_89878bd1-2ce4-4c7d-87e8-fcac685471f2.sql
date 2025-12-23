-- Add new fields to patients table for comprehensive registration
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS record_code SERIAL,
ADD COLUMN IF NOT EXISTS is_company BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_foreigner BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS rg TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS birthplace TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
ADD COLUMN IF NOT EXISTS skin_color TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS religion TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS street_number TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS landline TEXT,
ADD COLUMN IF NOT EXISTS tag TEXT,
ADD COLUMN IF NOT EXISTS referral TEXT,
ADD COLUMN IF NOT EXISTS send_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS education TEXT,
ADD COLUMN IF NOT EXISTS mother_name TEXT,
ADD COLUMN IF NOT EXISTS father_name TEXT;

-- Create index on record_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_record_code ON public.patients(record_code);

-- Add comment explaining the fields
COMMENT ON COLUMN public.patients.record_code IS 'Código do prontuário - gerado automaticamente';
COMMENT ON COLUMN public.patients.is_company IS 'Se é pessoa jurídica';
COMMENT ON COLUMN public.patients.is_foreigner IS 'Se é estrangeiro';
COMMENT ON COLUMN public.patients.gender IS 'Sexo: M, F, O';
COMMENT ON COLUMN public.patients.marital_status IS 'Estado civil';
COMMENT ON COLUMN public.patients.priority IS 'Prioridade: none, high, medium, low';
COMMENT ON COLUMN public.patients.preferred_channel IS 'Canal preferido: whatsapp, sms, email';