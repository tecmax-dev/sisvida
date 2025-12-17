-- Create medical records table (prontuário)
CREATE TABLE public.medical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint TEXT,
  history_present_illness TEXT,
  physical_examination TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  prescription TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create anamnesis table (ficha de anamnese)
CREATE TABLE public.anamnesis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  filled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  allergies TEXT,
  current_medications TEXT,
  chronic_diseases TEXT,
  previous_surgeries TEXT,
  family_history TEXT,
  smoking BOOLEAN DEFAULT false,
  alcohol BOOLEAN DEFAULT false,
  physical_activity BOOLEAN DEFAULT false,
  blood_type TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis ENABLE ROW LEVEL SECURITY;

-- RLS policies for medical_records
CREATE POLICY "Users can view medical records of their clinics"
ON public.medical_records FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage medical records of their clinics"
ON public.medical_records FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS policies for anamnesis
CREATE POLICY "Users can view anamnesis of their clinics"
ON public.anamnesis FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage anamnesis of their clinics"
ON public.anamnesis FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- Public can create anamnesis (for patient self-fill)
CREATE POLICY "Public can create anamnesis"
ON public.anamnesis FOR INSERT
TO anon
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_medical_records_updated_at
BEFORE UPDATE ON public.medical_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_anamnesis_updated_at
BEFORE UPDATE ON public.anamnesis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();