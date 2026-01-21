-- Table to store negotiation previews with public access token
CREATE TABLE public.negotiation_previews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  access_token VARCHAR(64) NOT NULL UNIQUE,
  
  -- Negotiation data snapshot
  employer_name TEXT NOT NULL,
  employer_cnpj TEXT NOT NULL,
  employer_trade_name TEXT,
  
  -- Settings snapshot
  interest_rate_monthly NUMERIC NOT NULL,
  monetary_correction_monthly NUMERIC NOT NULL,
  late_fee_percentage NUMERIC NOT NULL,
  legal_basis TEXT,
  
  -- Totals
  total_original_value NUMERIC NOT NULL,
  total_interest NUMERIC NOT NULL,
  total_correction NUMERIC NOT NULL,
  total_late_fee NUMERIC NOT NULL,
  total_negotiated_value NUMERIC NOT NULL,
  
  -- Installment info
  installments_count INTEGER NOT NULL,
  installment_value NUMERIC NOT NULL,
  down_payment NUMERIC NOT NULL DEFAULT 0,
  first_due_date DATE NOT NULL,
  
  -- Contributions data (JSON array)
  contributions_data JSONB NOT NULL,
  
  -- Custom installment dates (JSON object)
  custom_dates JSONB,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  viewed_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.negotiation_previews ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to manage their clinic's previews
CREATE POLICY "Users can manage their clinic previews"
ON public.negotiation_previews
FOR ALL
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Policy for public access via token (SELECT only)
CREATE POLICY "Public can view previews with valid token"
ON public.negotiation_previews
FOR SELECT
USING (
  expires_at > now()
);

-- Index for token lookup
CREATE INDEX idx_negotiation_previews_token ON public.negotiation_previews(access_token);

-- Index for clinic
CREATE INDEX idx_negotiation_previews_clinic ON public.negotiation_previews(clinic_id);