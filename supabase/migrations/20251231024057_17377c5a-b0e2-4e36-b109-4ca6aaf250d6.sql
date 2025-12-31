-- Create table for professional schedule exceptions (specific date overrides)
CREATE TABLE public.professional_schedule_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  is_day_off BOOLEAN DEFAULT false,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(professional_id, exception_date)
);

-- Enable RLS
ALTER TABLE public.professional_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Clinic members can view schedule exceptions"
ON public.professional_schedule_exceptions
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage schedule exceptions"
ON public.professional_schedule_exceptions
FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Public can view for booking purposes
CREATE POLICY "Public can view schedule exceptions for booking"
ON public.professional_schedule_exceptions
FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_professional_schedule_exceptions_updated_at
BEFORE UPDATE ON public.professional_schedule_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_schedule_exceptions_professional_date 
ON public.professional_schedule_exceptions(professional_id, exception_date);