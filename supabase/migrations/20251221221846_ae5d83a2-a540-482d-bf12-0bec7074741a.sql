-- Create table for procedure-specific insurance prices
CREATE TABLE public.procedure_insurance_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  insurance_plan_id UUID NOT NULL REFERENCES public.insurance_plans(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(procedure_id, insurance_plan_id)
);

-- Enable RLS
ALTER TABLE public.procedure_insurance_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view procedure prices of their clinics" 
ON public.procedure_insurance_prices
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.procedures p 
    WHERE p.id = procedure_insurance_prices.procedure_id 
    AND has_clinic_access(auth.uid(), p.clinic_id)
  )
);

CREATE POLICY "Admins can manage procedure prices" 
ON public.procedure_insurance_prices
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.procedures p 
    WHERE p.id = procedure_insurance_prices.procedure_id 
    AND is_clinic_admin(auth.uid(), p.clinic_id)
  )
);

-- Public can view prices for active procedures in active insurance plans
CREATE POLICY "Public can view active procedure prices"
ON public.procedure_insurance_prices
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.procedures p 
    JOIN public.insurance_plans ip ON ip.id = procedure_insurance_prices.insurance_plan_id
    WHERE p.id = procedure_insurance_prices.procedure_id 
    AND p.is_active = true
    AND ip.is_active = true
  )
);