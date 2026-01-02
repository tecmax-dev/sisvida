-- Create employers table
CREATE TABLE public.employers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  name TEXT NOT NULL,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, cnpj)
);

-- Enable RLS
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Clinic members can view their employers"
ON public.employers FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage employers"
ON public.employers FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Create index for performance
CREATE INDEX idx_employers_clinic_id ON public.employers(clinic_id);
CREATE INDEX idx_employers_cnpj ON public.employers(cnpj);

-- Add trigger for updated_at
CREATE TRIGGER update_employers_updated_at
  BEFORE UPDATE ON public.employers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();