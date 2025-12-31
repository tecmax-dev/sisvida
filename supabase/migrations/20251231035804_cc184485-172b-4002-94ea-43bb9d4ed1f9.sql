-- Create junction table for professionals and insurance plans
CREATE TABLE public.professional_insurance_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  insurance_plan_id UUID NOT NULL REFERENCES public.insurance_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(professional_id, insurance_plan_id)
);

-- Enable RLS
ALTER TABLE public.professional_insurance_plans ENABLE ROW LEVEL SECURITY;

-- Create policies using existing security functions
CREATE POLICY "Users can view professional insurance plans for their clinic"
ON public.professional_insurance_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = professional_insurance_plans.professional_id
    AND has_clinic_access(auth.uid(), p.clinic_id)
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Clinic admins can manage professional insurance plans"
ON public.professional_insurance_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = professional_insurance_plans.professional_id
    AND is_clinic_admin(auth.uid(), p.clinic_id)
  )
  OR is_super_admin(auth.uid())
);

-- Add indexes for better performance
CREATE INDEX idx_professional_insurance_plans_professional ON public.professional_insurance_plans(professional_id);
CREATE INDEX idx_professional_insurance_plans_insurance ON public.professional_insurance_plans(insurance_plan_id);