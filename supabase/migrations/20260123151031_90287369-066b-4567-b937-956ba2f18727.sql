-- Create table for patient payslip history (validated contracheques)
CREATE TABLE public.patient_payslip_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  payslip_request_id UUID REFERENCES public.payslip_requests(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.patient_cards(id) ON DELETE SET NULL,
  
  -- Document info
  attachment_path TEXT NOT NULL,
  attachment_url TEXT,
  
  -- Validation info
  validation_status TEXT NOT NULL CHECK (validation_status IN ('approved', 'rejected')),
  validation_notes TEXT,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  validated_by UUID REFERENCES auth.users(id),
  
  -- Card expiry changes
  previous_card_expiry DATE,
  new_card_expiry DATE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_payslip_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view payslip history of their clinic"
ON public.patient_payslip_history
FOR SELECT
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert payslip history for their clinic"
ON public.patient_payslip_history
FOR INSERT
WITH CHECK (
  clinic_id IN (
    SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update payslip history of their clinic"
ON public.patient_payslip_history
FOR UPDATE
USING (
  clinic_id IN (
    SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_patient_payslip_history_patient ON public.patient_payslip_history(patient_id);
CREATE INDEX idx_patient_payslip_history_clinic ON public.patient_payslip_history(clinic_id);
CREATE INDEX idx_patient_payslip_history_validated_at ON public.patient_payslip_history(validated_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_patient_payslip_history_updated_at
BEFORE UPDATE ON public.patient_payslip_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.patient_payslip_history IS 'Histórico de contracheques validados/rejeitados por paciente';