
-- =============================================
-- PARTE 1: CPF ÚNICO POR CLÍNICA
-- =============================================

-- Índice único composto (clinic_id + cpf) - permite mesmo CPF em clínicas diferentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_cpf_clinic 
ON public.patients (clinic_id, cpf) 
WHERE cpf IS NOT NULL AND cpf <> '';

-- Função para validar CPF duplicado antes do insert/update
CREATE OR REPLACE FUNCTION public.check_cpf_duplicate()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    IF EXISTS (
      SELECT 1 FROM patients 
      WHERE clinic_id = NEW.clinic_id 
      AND cpf = NEW.cpf 
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'CPF_DUPLICADO: Este CPF já está cadastrado no sistema.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para validação de CPF
DROP TRIGGER IF EXISTS trigger_check_cpf_duplicate ON public.patients;
CREATE TRIGGER trigger_check_cpf_duplicate
BEFORE INSERT OR UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.check_cpf_duplicate();

-- =============================================
-- PARTE 2: SISTEMA DE ANAMNESE DINÂMICA
-- =============================================

-- Tabela de modelos/templates de anamnese
CREATE TABLE IF NOT EXISTS public.anamnese_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_anamnese_templates_updated_at
BEFORE UPDATE ON public.anamnese_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de perguntas do template
CREATE TABLE IF NOT EXISTS public.anamnese_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.anamnese_templates(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text', 'textarea', 'radio', 'checkbox', 'select', 'date', 'number', 'boolean')),
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de opções para perguntas de múltipla escolha
CREATE TABLE IF NOT EXISTS public.anamnese_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.anamnese_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Tabela de respostas do paciente (vínculo com template)
CREATE TABLE IF NOT EXISTS public.anamnese_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.anamnese_templates(id),
  professional_id UUID REFERENCES public.professionals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_anamnese_responses_updated_at
BEFORE UPDATE ON public.anamnese_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de respostas individuais de cada pergunta
CREATE TABLE IF NOT EXISTS public.anamnese_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.anamnese_responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.anamnese_questions(id),
  answer_text TEXT,
  answer_option_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- PARTE 3: ROW LEVEL SECURITY
-- =============================================

-- RLS para anamnese_templates
ALTER TABLE public.anamnese_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates of their clinics"
ON public.anamnese_templates FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage templates"
ON public.anamnese_templates FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Staff can insert templates"
ON public.anamnese_templates FOR INSERT
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

-- RLS para anamnese_questions
ALTER TABLE public.anamnese_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions of accessible templates"
ON public.anamnese_questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.anamnese_templates t 
  WHERE t.id = template_id 
  AND has_clinic_access(auth.uid(), t.clinic_id)
));

CREATE POLICY "Admins can manage questions"
ON public.anamnese_questions FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.anamnese_templates t 
  WHERE t.id = template_id 
  AND is_clinic_admin(auth.uid(), t.clinic_id)
));

CREATE POLICY "Staff can insert questions"
ON public.anamnese_questions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.anamnese_templates t 
  WHERE t.id = template_id 
  AND has_clinic_access(auth.uid(), t.clinic_id)
));

-- RLS para anamnese_question_options
ALTER TABLE public.anamnese_question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view options of accessible questions"
ON public.anamnese_question_options FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.anamnese_questions q
  JOIN public.anamnese_templates t ON t.id = q.template_id
  WHERE q.id = question_id 
  AND has_clinic_access(auth.uid(), t.clinic_id)
));

CREATE POLICY "Admins can manage options"
ON public.anamnese_question_options FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.anamnese_questions q
  JOIN public.anamnese_templates t ON t.id = q.template_id
  WHERE q.id = question_id 
  AND is_clinic_admin(auth.uid(), t.clinic_id)
));

CREATE POLICY "Staff can insert options"
ON public.anamnese_question_options FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.anamnese_questions q
  JOIN public.anamnese_templates t ON t.id = q.template_id
  WHERE q.id = question_id 
  AND has_clinic_access(auth.uid(), t.clinic_id)
));

-- RLS para anamnese_responses
ALTER TABLE public.anamnese_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view responses of their clinics"
ON public.anamnese_responses FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage responses of their clinics"
ON public.anamnese_responses FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can insert responses"
ON public.anamnese_responses FOR INSERT
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));

-- RLS para anamnese_answers
ALTER TABLE public.anamnese_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view answers of accessible responses"
ON public.anamnese_answers FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.anamnese_responses r 
  WHERE r.id = response_id 
  AND has_clinic_access(auth.uid(), r.clinic_id)
));

CREATE POLICY "Users can manage answers"
ON public.anamnese_answers FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.anamnese_responses r 
  WHERE r.id = response_id 
  AND has_clinic_access(auth.uid(), r.clinic_id)
));

CREATE POLICY "Users can insert answers"
ON public.anamnese_answers FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.anamnese_responses r 
  WHERE r.id = response_id 
  AND has_clinic_access(auth.uid(), r.clinic_id)
));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_anamnese_templates_clinic ON public.anamnese_templates(clinic_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_questions_template ON public.anamnese_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_question_options_question ON public.anamnese_question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_responses_patient ON public.anamnese_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_responses_template ON public.anamnese_responses(template_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_answers_response ON public.anamnese_answers(response_id);
