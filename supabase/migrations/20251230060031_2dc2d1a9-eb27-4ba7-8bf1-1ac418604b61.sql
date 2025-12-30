-- Create medications table for clinics
CREATE TABLE public.medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active_ingredient TEXT,
  dosage TEXT,
  form TEXT, -- comprimido, cápsula, solução, etc.
  instructions TEXT, -- posologia padrão
  is_controlled BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster searches
CREATE INDEX idx_medications_clinic_id ON public.medications(clinic_id);
CREATE INDEX idx_medications_name ON public.medications(name);
CREATE INDEX idx_medications_active ON public.medications(clinic_id, is_active);

-- Enable Row Level Security
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Create policies using existing helper functions
CREATE POLICY "Users can view medications from their clinic" 
ON public.medications 
FOR SELECT 
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage medications" 
ON public.medications 
FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_medications_updated_at
BEFORE UPDATE ON public.medications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();