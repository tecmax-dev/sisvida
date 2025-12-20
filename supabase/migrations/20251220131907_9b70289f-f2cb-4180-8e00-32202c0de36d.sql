-- Create procedures table
CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  category TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_procedures_clinic_id ON public.procedures(clinic_id);
CREATE INDEX idx_procedures_is_active ON public.procedures(is_active);

-- Enable RLS
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for procedures
CREATE POLICY "Clinic admins can manage procedures"
ON public.procedures FOR ALL
USING (public.is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic staff can view procedures"
ON public.procedures FOR SELECT
USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Add procedure_id to appointments
ALTER TABLE public.appointments 
ADD COLUMN procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX idx_appointments_procedure_id ON public.appointments(procedure_id);

-- Add procedure_id to financial_transactions
ALTER TABLE public.financial_transactions 
ADD COLUMN procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX idx_financial_transactions_procedure_id ON public.financial_transactions(procedure_id);

-- Trigger for updated_at
CREATE TRIGGER update_procedures_updated_at
BEFORE UPDATE ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();