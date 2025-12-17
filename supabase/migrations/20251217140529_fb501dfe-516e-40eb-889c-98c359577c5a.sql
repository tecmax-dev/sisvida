-- Create document_settings table for customizing printed documents
CREATE TABLE public.document_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  
  -- Header settings
  show_logo BOOLEAN DEFAULT true,
  show_address BOOLEAN DEFAULT true,
  show_phone BOOLEAN DEFAULT true,
  show_cnpj BOOLEAN DEFAULT true,
  custom_header_text TEXT,
  
  -- Footer settings
  footer_text TEXT DEFAULT 'Este documento foi gerado eletronicamente pelo sistema Eclini',
  show_footer BOOLEAN DEFAULT true,
  
  -- Prescription settings
  prescription_title TEXT DEFAULT 'RECEITUÁRIO',
  prescription_template TEXT,
  
  -- Certificate settings  
  certificate_title TEXT DEFAULT 'ATESTADO MÉDICO',
  certificate_template TEXT DEFAULT 'Atesto para os devidos fins que o(a) paciente {patient_name} esteve sob meus cuidados profissionais na data de {date}, necessitando de afastamento de suas atividades por um período de {days} dia(s).',
  
  -- Attendance declaration settings
  attendance_title TEXT DEFAULT 'DECLARAÇÃO DE COMPARECIMENTO',
  attendance_template TEXT DEFAULT 'Declaro para os devidos fins que o(a) Sr(a). {patient_name} compareceu a este estabelecimento de saúde na data de {date}, no período das {start_time} às {end_time}, para atendimento médico/consulta.',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(clinic_id)
);

-- Enable RLS
ALTER TABLE public.document_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view document settings of their clinics"
ON public.document_settings
FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage document settings"
ON public.document_settings
FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger for updated_at
CREATE TRIGGER update_document_settings_updated_at
BEFORE UPDATE ON public.document_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();