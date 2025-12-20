-- Tabela mestre de recursos do sistema
CREATE TABLE public.system_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_features ENABLE ROW LEVEL SECURITY;

-- Policies para system_features
CREATE POLICY "Super admins can manage features"
ON public.system_features FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Public can view active features"
ON public.system_features FOR SELECT
USING (is_active = true);

-- Tabela de vínculo entre planos e recursos
CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.system_features(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, feature_id)
);

-- Habilitar RLS
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Policies para plan_features
CREATE POLICY "Super admins can manage plan features"
ON public.plan_features FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Public can view plan features"
ON public.plan_features FOR SELECT
USING (true);

-- Tabela de solicitações de upgrade
CREATE TABLE public.upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  current_plan_id UUID REFERENCES public.subscription_plans(id),
  requested_plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  admin_notes TEXT,
  requested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Policies para upgrade_requests
CREATE POLICY "Super admins can manage upgrade requests"
ON public.upgrade_requests FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can view their upgrade requests"
ON public.upgrade_requests FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can create upgrade requests"
ON public.upgrade_requests FOR INSERT
WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

-- Popular recursos padrão do sistema
INSERT INTO public.system_features (key, name, description, category, icon) VALUES
-- Categoria: Anamnese
('dynamic_anamnesis', 'Anamnese Dinâmica', 'Criação de templates de anamnese personalizados', 'anamnese', 'FileText'),
('public_anamnesis', 'Anamnese Pública', 'Link público para paciente preencher anamnese', 'anamnese', 'Link'),

-- Categoria: WhatsApp
('whatsapp_reminders', 'Lembretes Automáticos WhatsApp', 'Envio automático de lembretes de consulta', 'whatsapp', 'Bell'),
('whatsapp_anamnesis', 'Envio de Anamnese por WhatsApp', 'Enviar link de anamnese via WhatsApp', 'whatsapp', 'MessageSquare'),
('whatsapp_documents', 'Envio de Documentos por WhatsApp', 'Enviar receitas e atestados via WhatsApp', 'whatsapp', 'Send'),

-- Categoria: Financeiro
('financial_management', 'Gestão Financeira', 'Controle de receitas e despesas', 'financial', 'DollarSign'),
('financial_reports', 'Relatórios Financeiros', 'Relatórios e gráficos financeiros', 'financial', 'BarChart'),
('payment_plans', 'Parcelamentos', 'Criar planos de pagamento para pacientes', 'financial', 'CreditCard'),

-- Categoria: Médico
('odontogram', 'Odontograma Digital', 'Registro odontológico visual', 'medical', 'Smile'),
('digital_prescription', 'Receituário Digital', 'Emissão de receitas digitais', 'medical', 'FileCheck'),
('medical_certificate', 'Atestados Médicos', 'Emissão de atestados', 'medical', 'Award'),
('attendance_declaration', 'Declaração de Comparecimento', 'Emissão de declarações', 'medical', 'ClipboardList'),
('digital_signature', 'Assinatura Digital', 'Assinatura em documentos médicos', 'medical', 'PenTool'),

-- Categoria: Pacientes
('patient_import', 'Importação de Pacientes', 'Importar pacientes via planilha', 'patients', 'Upload'),
('patient_export', 'Exportação de Dados', 'Exportar dados em Excel/PDF', 'patients', 'Download'),

-- Categoria: Agendamento
('waiting_list', 'Lista de Espera', 'Gerenciar lista de espera de pacientes', 'scheduling', 'Clock'),
('online_booking', 'Agendamento Online', 'Link público para pacientes agendarem', 'scheduling', 'Calendar'),

-- Categoria: Integrações
('public_api', 'API Pública', 'Acesso à API para integrações', 'integrations', 'Code'),
('webhooks', 'Webhooks', 'Notificações para sistemas externos', 'integrations', 'Webhook'),

-- Categoria: Relatórios
('basic_reports', 'Relatórios Básicos', 'Relatórios de agendamentos e pacientes', 'reports', 'FileSpreadsheet'),
('advanced_reports', 'Relatórios Avançados', 'Relatórios detalhados e analytics', 'reports', 'TrendingUp'),

-- Categoria: Gestão
('multi_professional', 'Múltiplos Profissionais', 'Cadastrar mais de 1 profissional', 'management', 'Users'),
('insurance_management', 'Gestão de Convênios', 'Gerenciar convênios e planos de saúde', 'management', 'Building'),
('procedures_management', 'Gestão de Procedimentos', 'Cadastro e precificação de procedimentos', 'management', 'ListChecks'),
('custom_branding', 'Logo Personalizada', 'Logo da clínica nos documentos', 'management', 'Image'),
('priority_support', 'Suporte Prioritário', 'Atendimento prioritário da equipe', 'management', 'Headphones');