-- =====================================================
-- MÓDULO JURÍDICO SINDICAL - ESTRUTURA COMPLETA
-- =====================================================

-- Enum para tipos de processo
DO $$ BEGIN
  CREATE TYPE public.legal_case_type AS ENUM (
    'trabalhista', 'civel', 'tributario', 'administrativo', 'coletivo_sindical', 'outro'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para status do processo
DO $$ BEGIN
  CREATE TYPE public.legal_case_status AS ENUM (
    'ativo', 'suspenso', 'arquivado', 'encerrado_favoravel', 'encerrado_desfavoravel', 'acordo'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para nível de risco
DO $$ BEGIN
  CREATE TYPE public.legal_risk_level AS ENUM (
    'baixo', 'medio', 'alto', 'critico'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para criticidade de prazo
DO $$ BEGIN
  CREATE TYPE public.deadline_criticality AS ENUM (
    'baixa', 'media', 'alta', 'urgente'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum para status do prazo
DO $$ BEGIN
  CREATE TYPE public.deadline_status AS ENUM (
    'pendente', 'cumprido', 'descumprido', 'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABELA: ESCRITÓRIOS JURÍDICOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_law_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  oab_number TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  contract_start_date DATE,
  contract_end_date DATE,
  contract_value NUMERIC(15, 2),
  payment_type TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: ADVOGADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  law_firm_id UUID REFERENCES public.union_law_firms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT,
  oab_number TEXT NOT NULL,
  oab_state TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialty TEXT,
  hourly_rate NUMERIC(15, 2),
  is_internal BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: PROCESSOS JUDICIAIS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  
  -- Identificação do processo
  case_number TEXT NOT NULL,
  case_type public.legal_case_type NOT NULL DEFAULT 'trabalhista',
  subject TEXT NOT NULL,
  description TEXT,
  
  -- Localização judicial
  court TEXT,
  instance TEXT,
  tribunal TEXT,
  jurisdiction TEXT,
  
  -- Partes envolvidas
  plaintiff TEXT NOT NULL,
  plaintiff_document TEXT,
  defendant TEXT NOT NULL,
  defendant_document TEXT,
  union_role TEXT NOT NULL DEFAULT 'parte',
  
  -- Valores e risco
  cause_value NUMERIC(15, 2),
  estimated_liability NUMERIC(15, 2),
  risk_level public.legal_risk_level DEFAULT 'medio',
  risk_notes TEXT,
  
  -- Status e datas
  status public.legal_case_status DEFAULT 'ativo',
  filing_date DATE,
  service_date DATE,
  last_update_date DATE,
  closure_date DATE,
  closure_reason TEXT,
  
  -- Vinculações
  lawyer_id UUID REFERENCES public.union_lawyers(id) ON DELETE SET NULL,
  law_firm_id UUID REFERENCES public.union_law_firms(id) ON DELETE SET NULL,
  employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.sindical_associados(id) ON DELETE SET NULL,
  
  -- Metadados
  priority INTEGER DEFAULT 0,
  tags TEXT[],
  external_reference TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: PARTES DO PROCESSO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES public.union_legal_cases(id) ON DELETE CASCADE,
  party_type TEXT NOT NULL,
  name TEXT NOT NULL,
  document TEXT,
  document_type TEXT,
  role_description TEXT,
  is_union BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELA: ANDAMENTOS PROCESSUAIS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES public.union_legal_cases(id) ON DELETE CASCADE,
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  phase TEXT,
  is_milestone BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: DOCUMENTOS DO PROCESSO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES public.union_legal_cases(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.union_legal_case_events(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  storage_path TEXT,
  external_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: PRAZOS PROCESSUAIS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  legal_case_id UUID NOT NULL REFERENCES public.union_legal_cases(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  deadline_date DATE NOT NULL,
  deadline_time TIME,
  criticality public.deadline_criticality DEFAULT 'media',
  status public.deadline_status DEFAULT 'pendente',
  
  responsible_lawyer_id UUID REFERENCES public.union_lawyers(id) ON DELETE SET NULL,
  responsible_user_id UUID REFERENCES auth.users(id),
  
  alert_days_before INTEGER[] DEFAULT ARRAY[7, 3, 1],
  last_alert_sent_at TIMESTAMPTZ,
  
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  completion_notes TEXT,
  
  missed_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: HISTÓRICO DE ALERTAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_deadline_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id UUID NOT NULL REFERENCES public.union_legal_deadlines(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_to TEXT,
  days_before INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- =====================================================
-- TABELA: DESPESAS JURÍDICAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  legal_case_id UUID REFERENCES public.union_legal_cases(id) ON DELETE SET NULL,
  law_firm_id UUID REFERENCES public.union_law_firms(id) ON DELETE SET NULL,
  lawyer_id UUID REFERENCES public.union_lawyers(id) ON DELETE SET NULL,
  
  expense_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  expense_date DATE NOT NULL,
  
  financial_transaction_id UUID REFERENCES public.union_financial_transactions(id) ON DELETE SET NULL,
  
  is_paid BOOLEAN DEFAULT false,
  paid_at DATE,
  payment_reference TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: PROVISÕES DE PASSIVO JURÍDICO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  legal_case_id UUID NOT NULL REFERENCES public.union_legal_cases(id) ON DELETE CASCADE,
  
  provision_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  probability_percentage NUMERIC(5, 2),
  calculated_amount NUMERIC(15, 2),
  
  reason TEXT,
  review_date DATE,
  
  is_current BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABELA: AUDITORIA DO MÓDULO JURÍDICO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.union_legal_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  performed_at TIMESTAMPTZ DEFAULT now(),
  performed_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_legal_cases_clinic ON public.union_legal_cases(clinic_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_status ON public.union_legal_cases(status);
CREATE INDEX IF NOT EXISTS idx_legal_cases_type ON public.union_legal_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_legal_cases_risk ON public.union_legal_cases(risk_level);
CREATE INDEX IF NOT EXISTS idx_legal_cases_lawyer ON public.union_legal_cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_employer ON public.union_legal_cases(employer_id);

CREATE INDEX IF NOT EXISTS idx_legal_deadlines_clinic ON public.union_legal_deadlines(clinic_id);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_date ON public.union_legal_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_status ON public.union_legal_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_case ON public.union_legal_deadlines(legal_case_id);

CREATE INDEX IF NOT EXISTS idx_legal_events_case ON public.union_legal_case_events(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_legal_events_date ON public.union_legal_case_events(event_date);

CREATE INDEX IF NOT EXISTS idx_legal_documents_case ON public.union_legal_case_documents(legal_case_id);

CREATE INDEX IF NOT EXISTS idx_legal_expenses_clinic ON public.union_legal_expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_legal_expenses_case ON public.union_legal_expenses(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_legal_expenses_date ON public.union_legal_expenses(expense_date);

CREATE INDEX IF NOT EXISTS idx_law_firms_clinic ON public.union_law_firms(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lawyers_clinic ON public.union_lawyers(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lawyers_firm ON public.union_lawyers(law_firm_id);

CREATE INDEX IF NOT EXISTS idx_legal_audit_clinic ON public.union_legal_audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_legal_audit_entity ON public.union_legal_audit_logs(entity_type, entity_id);

-- =====================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- =====================================================
ALTER TABLE public.union_law_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_deadline_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.union_legal_audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS - ESCRITÓRIOS JURÍDICOS
-- =====================================================
CREATE POLICY "law_firms_select" ON public.union_law_firms
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "law_firms_insert" ON public.union_law_firms
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "law_firms_update" ON public.union_law_firms
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "law_firms_delete" ON public.union_law_firms
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR
    public.is_clinic_admin(auth.uid(), clinic_id)
  );

-- =====================================================
-- POLÍTICAS RLS - ADVOGADOS
-- =====================================================
CREATE POLICY "lawyers_select" ON public.union_lawyers
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "lawyers_insert" ON public.union_lawyers
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "lawyers_update" ON public.union_lawyers
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "lawyers_delete" ON public.union_lawyers
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR
    public.is_clinic_admin(auth.uid(), clinic_id)
  );

-- =====================================================
-- POLÍTICAS RLS - PROCESSOS
-- =====================================================
CREATE POLICY "legal_cases_select" ON public.union_legal_cases
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "legal_cases_insert" ON public.union_legal_cases
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "legal_cases_update" ON public.union_legal_cases
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "legal_cases_delete" ON public.union_legal_cases
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR
    public.is_clinic_admin(auth.uid(), clinic_id)
  );

-- =====================================================
-- POLÍTICAS RLS - PARTES DO PROCESSO
-- =====================================================
CREATE POLICY "case_parties_select" ON public.union_legal_case_parties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_parties_insert" ON public.union_legal_case_parties
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_parties_update" ON public.union_legal_case_parties
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_parties_delete" ON public.union_legal_case_parties
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), lc.clinic_id))
    )
  );

-- =====================================================
-- POLÍTICAS RLS - ANDAMENTOS
-- =====================================================
CREATE POLICY "case_events_select" ON public.union_legal_case_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_events_insert" ON public.union_legal_case_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_events_update" ON public.union_legal_case_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_events_delete" ON public.union_legal_case_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), lc.clinic_id))
    )
  );

-- =====================================================
-- POLÍTICAS RLS - DOCUMENTOS
-- =====================================================
CREATE POLICY "case_documents_select" ON public.union_legal_case_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_documents_insert" ON public.union_legal_case_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_documents_update" ON public.union_legal_case_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), lc.clinic_id))
    )
  );

CREATE POLICY "case_documents_delete" ON public.union_legal_case_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_cases lc
      WHERE lc.id = legal_case_id
      AND (public.is_super_admin(auth.uid()) OR public.is_clinic_admin(auth.uid(), lc.clinic_id))
    )
  );

-- =====================================================
-- POLÍTICAS RLS - PRAZOS
-- =====================================================
CREATE POLICY "deadlines_select" ON public.union_legal_deadlines
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "deadlines_insert" ON public.union_legal_deadlines
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "deadlines_update" ON public.union_legal_deadlines
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "deadlines_delete" ON public.union_legal_deadlines
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR
    public.is_clinic_admin(auth.uid(), clinic_id)
  );

-- =====================================================
-- POLÍTICAS RLS - ALERTAS DE PRAZO
-- =====================================================
CREATE POLICY "deadline_alerts_select" ON public.union_legal_deadline_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.union_legal_deadlines d
      WHERE d.id = deadline_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), d.clinic_id))
    )
  );

CREATE POLICY "deadline_alerts_insert" ON public.union_legal_deadline_alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.union_legal_deadlines d
      WHERE d.id = deadline_id
      AND (public.is_super_admin(auth.uid()) OR public.has_clinic_access(auth.uid(), d.clinic_id))
    )
  );

-- =====================================================
-- POLÍTICAS RLS - DESPESAS
-- =====================================================
CREATE POLICY "expenses_select" ON public.union_legal_expenses
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "expenses_insert" ON public.union_legal_expenses
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "expenses_update" ON public.union_legal_expenses
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "expenses_delete" ON public.union_legal_expenses
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR
    public.is_clinic_admin(auth.uid(), clinic_id)
  );

-- =====================================================
-- POLÍTICAS RLS - PROVISÕES
-- =====================================================
CREATE POLICY "provisions_select" ON public.union_legal_provisions
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "provisions_insert" ON public.union_legal_provisions
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "provisions_update" ON public.union_legal_provisions
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "provisions_delete" ON public.union_legal_provisions
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR
    public.is_clinic_admin(auth.uid(), clinic_id)
  );

-- =====================================================
-- POLÍTICAS RLS - AUDITORIA
-- =====================================================
CREATE POLICY "audit_logs_select" ON public.union_legal_audit_logs
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

CREATE POLICY "audit_logs_insert" ON public.union_legal_audit_logs
  FOR INSERT WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_clinic_access(auth.uid(), clinic_id)
  );

-- =====================================================
-- TRIGGERS DE AUDITORIA
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_legal_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.union_legal_audit_logs (
      clinic_id, entity_type, entity_id, action, new_data, performed_by
    ) VALUES (
      NEW.clinic_id, TG_TABLE_NAME, NEW.id, 'create', to_jsonb(NEW), auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.union_legal_audit_logs (
      clinic_id, entity_type, entity_id, action, old_data, new_data, performed_by
    ) VALUES (
      NEW.clinic_id, TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.union_legal_audit_logs (
      clinic_id, entity_type, entity_id, action, old_data, performed_by
    ) VALUES (
      OLD.clinic_id, TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD), auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS audit_legal_cases ON public.union_legal_cases;
CREATE TRIGGER audit_legal_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.union_legal_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_legal_audit();

DROP TRIGGER IF EXISTS audit_legal_deadlines ON public.union_legal_deadlines;
CREATE TRIGGER audit_legal_deadlines
  AFTER INSERT OR UPDATE OR DELETE ON public.union_legal_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.log_legal_audit();

DROP TRIGGER IF EXISTS audit_legal_expenses ON public.union_legal_expenses;
CREATE TRIGGER audit_legal_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.union_legal_expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_legal_audit();

DROP TRIGGER IF EXISTS audit_law_firms ON public.union_law_firms;
CREATE TRIGGER audit_law_firms
  AFTER INSERT OR UPDATE OR DELETE ON public.union_law_firms
  FOR EACH ROW EXECUTE FUNCTION public.log_legal_audit();

DROP TRIGGER IF EXISTS audit_lawyers ON public.union_lawyers;
CREATE TRIGGER audit_lawyers
  AFTER INSERT OR UPDATE OR DELETE ON public.union_lawyers
  FOR EACH ROW EXECUTE FUNCTION public.log_legal_audit();

-- =====================================================
-- TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_legal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_legal_cases_timestamp ON public.union_legal_cases;
CREATE TRIGGER update_legal_cases_timestamp
  BEFORE UPDATE ON public.union_legal_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_legal_updated_at();

DROP TRIGGER IF EXISTS update_legal_deadlines_timestamp ON public.union_legal_deadlines;
CREATE TRIGGER update_legal_deadlines_timestamp
  BEFORE UPDATE ON public.union_legal_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_legal_updated_at();

DROP TRIGGER IF EXISTS update_legal_expenses_timestamp ON public.union_legal_expenses;
CREATE TRIGGER update_legal_expenses_timestamp
  BEFORE UPDATE ON public.union_legal_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_legal_updated_at();

DROP TRIGGER IF EXISTS update_law_firms_timestamp ON public.union_law_firms;
CREATE TRIGGER update_law_firms_timestamp
  BEFORE UPDATE ON public.union_law_firms
  FOR EACH ROW EXECUTE FUNCTION public.update_legal_updated_at();

DROP TRIGGER IF EXISTS update_lawyers_timestamp ON public.union_lawyers;
CREATE TRIGGER update_lawyers_timestamp
  BEFORE UPDATE ON public.union_lawyers
  FOR EACH ROW EXECUTE FUNCTION public.update_legal_updated_at();

-- =====================================================
-- STORAGE BUCKET PARA DOCUMENTOS JURÍDICOS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "legal_docs_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'legal-documents' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "legal_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'legal-documents' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "legal_docs_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'legal-documents' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "legal_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'legal-documents' AND
    public.is_super_admin(auth.uid())
  );