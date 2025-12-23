-- Criar tabela para armazenar documentos médicos emitidos
CREATE TABLE public.medical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id),
  medical_record_id UUID REFERENCES medical_records(id),
  
  -- Tipo de documento
  document_type TEXT NOT NULL CHECK (document_type IN ('prescription', 'certificate', 'attendance', 'exam_request')),
  
  -- Conteúdo do documento
  content TEXT NOT NULL,
  additional_info JSONB,
  
  -- Metadados
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_via_whatsapp BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_to_phone TEXT,
  
  -- Assinatura digital
  is_signed BOOLEAN DEFAULT false,
  signature_data TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_medical_documents_clinic_id ON public.medical_documents(clinic_id);
CREATE INDEX idx_medical_documents_patient_id ON public.medical_documents(patient_id);
CREATE INDEX idx_medical_documents_document_type ON public.medical_documents(document_type);
CREATE INDEX idx_medical_documents_document_date ON public.medical_documents(document_date);

-- Habilitar RLS
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can manage documents of their clinics"
  ON public.medical_documents FOR ALL
  USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can view documents of their clinics"
  ON public.medical_documents FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

-- Trigger para updated_at
CREATE TRIGGER update_medical_documents_updated_at
  BEFORE UPDATE ON public.medical_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();