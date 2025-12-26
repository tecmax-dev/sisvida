-- Tabela de modelos de pacotes (templates)
CREATE TABLE public.package_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  validity_days INTEGER, -- NULL = sem validade
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pacotes vendidos aos pacientes
CREATE TABLE public.patient_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  package_template_id UUID REFERENCES public.package_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  used_sessions INTEGER NOT NULL DEFAULT 0,
  remaining_sessions INTEGER GENERATED ALWAYS AS (total_sessions - used_sessions) STORED,
  price NUMERIC NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE, -- NULL = sem validade
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de sessões consumidas
CREATE TABLE public.package_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_package_id UUID NOT NULL REFERENCES public.patient_packages(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  session_number INTEGER NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de pagamentos de pacotes
CREATE TABLE public.package_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_package_id UUID NOT NULL REFERENCES public.patient_packages(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_package_templates_clinic ON public.package_templates(clinic_id);
CREATE INDEX idx_patient_packages_clinic ON public.patient_packages(clinic_id);
CREATE INDEX idx_patient_packages_patient ON public.patient_packages(patient_id);
CREATE INDEX idx_patient_packages_status ON public.patient_packages(status);
CREATE INDEX idx_package_sessions_package ON public.package_sessions(patient_package_id);
CREATE INDEX idx_package_sessions_appointment ON public.package_sessions(appointment_id);
CREATE INDEX idx_package_payments_package ON public.package_payments(patient_package_id);
CREATE INDEX idx_package_payments_status ON public.package_payments(status);

-- RLS para package_templates
ALTER TABLE public.package_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view package templates of their clinics"
ON public.package_templates FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage package templates"
ON public.package_templates FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- RLS para patient_packages
ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view patient packages of their clinics"
ON public.patient_packages FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Users can manage patient packages of their clinics"
ON public.patient_packages FOR ALL
USING (has_clinic_access(auth.uid(), clinic_id));

-- RLS para package_sessions
ALTER TABLE public.package_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view package sessions of their clinics"
ON public.package_sessions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.patient_packages pp 
  WHERE pp.id = package_sessions.patient_package_id 
  AND has_clinic_access(auth.uid(), pp.clinic_id)
));

CREATE POLICY "Users can manage package sessions of their clinics"
ON public.package_sessions FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.patient_packages pp 
  WHERE pp.id = package_sessions.patient_package_id 
  AND has_clinic_access(auth.uid(), pp.clinic_id)
));

-- RLS para package_payments
ALTER TABLE public.package_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view package payments of their clinics"
ON public.package_payments FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage package payments"
ON public.package_payments FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_package_templates_updated_at
BEFORE UPDATE ON public.package_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_packages_updated_at
BEFORE UPDATE ON public.patient_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_package_payments_updated_at
BEFORE UPDATE ON public.package_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para consumir sessão automaticamente ao concluir consulta
CREATE OR REPLACE FUNCTION public.consume_package_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_package RECORD;
  v_session_count INTEGER;
BEGIN
  -- Apenas processa se o status mudou para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Busca pacote ativo do paciente para o procedimento da consulta
    SELECT pp.* INTO v_package
    FROM patient_packages pp
    WHERE pp.patient_id = NEW.patient_id
      AND pp.clinic_id = NEW.clinic_id
      AND pp.status = 'active'
      AND pp.remaining_sessions > 0
      AND (pp.expiry_date IS NULL OR pp.expiry_date >= CURRENT_DATE)
      AND (pp.procedure_id IS NULL OR pp.procedure_id = NEW.procedure_id)
    ORDER BY pp.expiry_date NULLS LAST, pp.created_at
    LIMIT 1;
    
    -- Se encontrou pacote, consome sessão
    IF v_package.id IS NOT NULL THEN
      -- Verifica se já não existe sessão para esta consulta
      SELECT COUNT(*) INTO v_session_count
      FROM package_sessions
      WHERE appointment_id = NEW.id;
      
      IF v_session_count = 0 THEN
        -- Incrementa sessões usadas
        UPDATE patient_packages
        SET used_sessions = used_sessions + 1,
            status = CASE 
              WHEN used_sessions + 1 >= total_sessions THEN 'completed'
              ELSE 'active'
            END
        WHERE id = v_package.id;
        
        -- Registra sessão consumida
        INSERT INTO package_sessions (
          patient_package_id,
          appointment_id,
          session_number,
          session_date,
          professional_id
        ) VALUES (
          v_package.id,
          NEW.id,
          v_package.used_sessions + 1,
          NEW.appointment_date,
          NEW.professional_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para consumir sessão ao concluir consulta
CREATE TRIGGER consume_package_session_on_complete
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.consume_package_session();