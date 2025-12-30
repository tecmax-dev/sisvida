-- Create junction table to link professionals to procedures they perform
CREATE TABLE public.professional_procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (professional_id, procedure_id)
);

-- Enable RLS
ALTER TABLE public.professional_procedures ENABLE ROW LEVEL SECURITY;

-- Policy: Users with access to the clinic can view professional procedures
CREATE POLICY "Users can view professional procedures for their clinic"
ON public.professional_procedures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.user_roles ur ON ur.clinic_id = p.clinic_id
    WHERE p.id = professional_procedures.professional_id
    AND ur.user_id = auth.uid()
  )
);

-- Policy: Public access for public booking pages (professionals are public)
CREATE POLICY "Public can view professional procedures"
ON public.professional_procedures
FOR SELECT
USING (true);

-- Policy: Admins can insert professional procedures
CREATE POLICY "Admins can insert professional procedures"
ON public.professional_procedures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.user_roles ur ON ur.clinic_id = p.clinic_id
    WHERE p.id = professional_procedures.professional_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner')
  )
);

-- Policy: Admins can delete professional procedures
CREATE POLICY "Admins can delete professional procedures"
ON public.professional_procedures
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.professionals p
    JOIN public.user_roles ur ON ur.clinic_id = p.clinic_id
    WHERE p.id = professional_procedures.professional_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner')
  )
);

-- Create index for better performance
CREATE INDEX idx_professional_procedures_professional ON public.professional_procedures(professional_id);
CREATE INDEX idx_professional_procedures_procedure ON public.professional_procedures(procedure_id);