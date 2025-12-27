
-- =====================================================
-- FASE 5: TISS (ANS) - Faturamento de Convênios
-- =====================================================

-- 1. Guias TISS
CREATE TABLE public.tiss_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  insurance_plan_id UUID NOT NULL REFERENCES public.insurance_plans(id) ON DELETE RESTRICT,
  guide_type TEXT NOT NULL CHECK (guide_type IN ('SP_SADT', 'CONSULTA', 'INTERNACAO', 'HONORARIOS')),
  guide_number TEXT NOT NULL,
  main_guide_id UUID REFERENCES public.tiss_guides(id) ON DELETE SET NULL,
  xml_version TEXT DEFAULT '4.01.00',
  provider_code TEXT,
  beneficiary_card TEXT,
  beneficiary_name TEXT,
  authorization_number TEXT,
  authorization_date DATE,
  execution_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'accepted', 'rejected', 'gloss', 'paid')),
  total_value NUMERIC(12,2) DEFAULT 0,
  gloss_value NUMERIC(12,2) DEFAULT 0,
  paid_value NUMERIC(12,2) DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (clinic_id, guide_number)
);

-- Índices
CREATE INDEX idx_tiss_guides_clinic ON public.tiss_guides(clinic_id);
CREATE INDEX idx_tiss_guides_patient ON public.tiss_guides(patient_id);
CREATE INDEX idx_tiss_guides_insurance ON public.tiss_guides(insurance_plan_id);
CREATE INDEX idx_tiss_guides_status ON public.tiss_guides(clinic_id, status);
CREATE INDEX idx_tiss_guides_date ON public.tiss_guides(clinic_id, execution_date);
CREATE INDEX idx_tiss_guides_number ON public.tiss_guides(guide_number);

-- RLS
ALTER TABLE public.tiss_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_guides_select" ON public.tiss_guides
  FOR SELECT USING (
    has_clinic_access(auth.uid(), clinic_id)
    AND (deleted_at IS NULL OR is_super_admin(auth.uid()))
  );

CREATE POLICY "tiss_guides_admin" ON public.tiss_guides
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_tiss_guides_updated_at
  BEFORE UPDATE ON public.tiss_guides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Itens da Guia TISS
CREATE TABLE public.tiss_guide_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES public.tiss_guides(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  tuss_code TEXT NOT NULL,
  tuss_description TEXT,
  execution_date DATE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'gloss', 'paid')),
  gloss_reason TEXT,
  gloss_code TEXT,
  gloss_value NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tiss_guide_items_clinic ON public.tiss_guide_items(clinic_id);
CREATE INDEX idx_tiss_guide_items_guide ON public.tiss_guide_items(guide_id);
CREATE INDEX idx_tiss_guide_items_appointment ON public.tiss_guide_items(appointment_id);
CREATE INDEX idx_tiss_guide_items_tuss ON public.tiss_guide_items(tuss_code);

-- RLS
ALTER TABLE public.tiss_guide_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_guide_items_select" ON public.tiss_guide_items
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "tiss_guide_items_admin" ON public.tiss_guide_items
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger
CREATE TRIGGER update_tiss_guide_items_updated_at
  BEFORE UPDATE ON public.tiss_guide_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Arquivos XML TISS
CREATE TABLE public.tiss_xml_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  guide_id UUID REFERENCES public.tiss_guides(id) ON DELETE SET NULL,
  batch_id UUID,
  file_type TEXT NOT NULL CHECK (file_type IN ('send', 'return', 'gloss', 'payment')),
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_hash TEXT,
  file_size INTEGER,
  xml_content TEXT,
  protocol_number TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tiss_xml_files_clinic ON public.tiss_xml_files(clinic_id);
CREATE INDEX idx_tiss_xml_files_guide ON public.tiss_xml_files(guide_id);
CREATE INDEX idx_tiss_xml_files_batch ON public.tiss_xml_files(batch_id);
CREATE INDEX idx_tiss_xml_files_protocol ON public.tiss_xml_files(protocol_number);

-- RLS
ALTER TABLE public.tiss_xml_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_xml_files_select" ON public.tiss_xml_files
  FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "tiss_xml_files_admin" ON public.tiss_xml_files
  FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- 4. Histórico de Status TISS
CREATE TABLE public.tiss_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES public.tiss_guides(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tiss_status_history_guide ON public.tiss_status_history(guide_id);

-- RLS
ALTER TABLE public.tiss_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiss_status_history_select" ON public.tiss_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tiss_guides g
      WHERE g.id = tiss_status_history.guide_id
      AND has_clinic_access(auth.uid(), g.clinic_id)
    )
  );

CREATE POLICY "tiss_status_history_insert" ON public.tiss_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiss_guides g
      WHERE g.id = tiss_status_history.guide_id
      AND is_clinic_admin(auth.uid(), g.clinic_id)
    )
  );

-- 5. Tabela TUSS (códigos de procedimentos)
CREATE TABLE public.tuss_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  table_type TEXT DEFAULT 'procedimentos',
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_tuss_codes_code ON public.tuss_codes(code);
CREATE INDEX idx_tuss_codes_search ON public.tuss_codes USING gin(to_tsvector('portuguese', description));

-- RLS (leitura pública)
ALTER TABLE public.tuss_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tuss_codes_select" ON public.tuss_codes
  FOR SELECT USING (true);

-- 6. Função para gerar número de guia
CREATE OR REPLACE FUNCTION public.generate_tiss_guide_number(p_clinic_id UUID, p_guide_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_year TEXT;
  v_count INTEGER;
  v_number TEXT;
BEGIN
  v_prefix := CASE p_guide_type
    WHEN 'SP_SADT' THEN 'S'
    WHEN 'CONSULTA' THEN 'C'
    WHEN 'INTERNACAO' THEN 'I'
    WHEN 'HONORARIOS' THEN 'H'
    ELSE 'G'
  END;
  
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.tiss_guides
  WHERE clinic_id = p_clinic_id
  AND guide_number LIKE v_prefix || v_year || '%';
  
  v_number := v_prefix || v_year || LPAD(v_count::TEXT, 6, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Trigger para registrar histórico de status
CREATE OR REPLACE FUNCTION public.log_tiss_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.tiss_status_history (guide_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tiss_guide_status_change
  AFTER UPDATE OF status ON public.tiss_guides
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tiss_status_change();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiss_guides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tiss_guide_items;
