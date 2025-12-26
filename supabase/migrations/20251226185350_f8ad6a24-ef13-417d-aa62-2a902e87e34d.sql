-- Criar tabela de definições de permissões (seed global)
CREATE TABLE public.permission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  parent_key TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para permission_definitions
CREATE POLICY "Anyone can view active permissions"
ON public.permission_definitions
FOR SELECT
USING (is_active = true);

CREATE POLICY "Super admins can manage permissions"
ON public.permission_definitions
FOR ALL
USING (is_super_admin(auth.uid()));

-- Criar tabela de grupos de acesso
CREATE TABLE public.access_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para access_groups
CREATE POLICY "Super admins can manage all access groups"
ON public.access_groups
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their access groups"
ON public.access_groups
FOR ALL
USING (clinic_id IS NOT NULL AND is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "Clinic users can view their access groups"
ON public.access_groups
FOR SELECT
USING (clinic_id IS NOT NULL AND has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Anyone can view global system groups"
ON public.access_groups
FOR SELECT
USING (clinic_id IS NULL AND is_system = true);

-- Criar tabela de permissões dos grupos
CREATE TABLE public.access_group_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_group_id UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(access_group_id, permission_key)
);

-- Habilitar RLS
ALTER TABLE public.access_group_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para access_group_permissions
CREATE POLICY "Super admins can manage all group permissions"
ON public.access_group_permissions
FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their group permissions"
ON public.access_group_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.access_groups ag
    WHERE ag.id = access_group_permissions.access_group_id
    AND ag.clinic_id IS NOT NULL
    AND is_clinic_admin(auth.uid(), ag.clinic_id)
  )
);

CREATE POLICY "Users can view their group permissions"
ON public.access_group_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.access_groups ag
    WHERE ag.id = access_group_permissions.access_group_id
    AND (
      (ag.clinic_id IS NOT NULL AND has_clinic_access(auth.uid(), ag.clinic_id))
      OR (ag.clinic_id IS NULL AND ag.is_system = true)
    )
  )
);

-- Adicionar coluna access_group_id na tabela user_roles
ALTER TABLE public.user_roles ADD COLUMN access_group_id UUID REFERENCES public.access_groups(id);

-- Criar função para verificar permissão do usuário
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id UUID, _clinic_id UUID, _permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Super admin tem todas as permissões
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
    UNION ALL
    -- Owner e Admin têm todas as permissões
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.clinic_id = _clinic_id
    AND ur.role IN ('owner', 'admin')
    UNION ALL
    -- Verificar permissão via grupo de acesso
    SELECT 1 FROM public.user_roles ur
    JOIN public.access_group_permissions agp ON agp.access_group_id = ur.access_group_id
    WHERE ur.user_id = _user_id
    AND ur.clinic_id = _clinic_id
    AND agp.permission_key = _permission_key
  )
$$;

-- Criar função para buscar todas as permissões do usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID, _clinic_id UUID)
RETURNS TABLE(permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Se for super admin, retorna todas as permissões
  SELECT pd.key
  FROM public.permission_definitions pd
  WHERE pd.is_active = true
  AND EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
  UNION
  -- Se for owner ou admin, retorna todas as permissões
  SELECT pd.key
  FROM public.permission_definitions pd
  WHERE pd.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.clinic_id = _clinic_id
    AND ur.role IN ('owner', 'admin')
  )
  UNION
  -- Retorna permissões do grupo de acesso
  SELECT agp.permission_key
  FROM public.user_roles ur
  JOIN public.access_group_permissions agp ON agp.access_group_id = ur.access_group_id
  WHERE ur.user_id = _user_id
  AND ur.clinic_id = _clinic_id
$$;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_access_groups_updated_at
BEFORE UPDATE ON public.access_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed de definições de permissões baseado no print
INSERT INTO public.permission_definitions (key, name, description, category, order_index) VALUES
-- Agendamento
('scheduling', 'Agendamento', 'Acesso ao módulo de agendamento', 'Agendamento', 1),
('view_calendar', 'Visualizar Agenda', 'Pode visualizar a agenda', 'Agendamento', 2),
('manage_calendar', 'Gerenciar Agenda', 'Pode criar/editar/cancelar agendamentos', 'Agendamento', 3),

-- Análise
('cash_flow_annual', 'Fluxo de Caixa Anual', 'Acesso ao fluxo de caixa anual', 'Análise', 1),
('cash_flow_monthly', 'Fluxo de Caixa Mensal', 'Acesso ao fluxo de caixa mensal', 'Análise', 2),
('view_reports', 'Relatórios', 'Acesso aos relatórios', 'Análise', 3),

-- Cadastros Gerais
('anamnesis_forms', 'Anamnese/Fichas/Contratos', 'Gerenciar anamneses e fichas', 'Cadastros Gerais', 1),
('custom_fields', 'Campo Personalizado', 'Gerenciar campos personalizados', 'Cadastros Gerais', 2),
('holidays', 'Feriados', 'Gerenciar feriados', 'Cadastros Gerais', 3),
('service_groups', 'Grupo de Serviços', 'Gerenciar grupos de serviços', 'Cadastros Gerais', 4),
('insurance_plans', 'Planos/Convênios', 'Gerenciar convênios', 'Cadastros Gerais', 5),
('recurring_transactions', 'Receita/Despesa Recorrente', 'Gerenciar recorrências', 'Cadastros Gerais', 6),
('rooms', 'Salas', 'Gerenciar salas', 'Cadastros Gerais', 7),
('sms_templates', 'SMS Templates', 'Gerenciar templates de SMS', 'Cadastros Gerais', 8),
('tags', 'Tags', 'Gerenciar tags', 'Cadastros Gerais', 9),

-- Caixa
('cashier', 'Caixa', 'Acesso ao módulo de caixa', 'Caixa', 1),
('manage_cashier', 'Gerenciar Caixa', 'Pode abrir/fechar caixa', 'Caixa', 2),

-- Clientes/Pacientes
('view_patients', 'Visualizar Pacientes', 'Pode ver lista de pacientes', 'Clientes', 1),
('manage_patients', 'Gerenciar Pacientes', 'Pode criar/editar pacientes', 'Clientes', 2),
('delete_patients', 'Excluir Pacientes', 'Pode excluir pacientes', 'Clientes', 3),

-- Configurações
('change_password', 'Alterar Senha', 'Pode alterar própria senha', 'Configurações', 1),
('company_data', 'Dados da Empresa', 'Gerenciar dados da clínica', 'Configurações', 2),
('email_settings', 'Email', 'Configurar email', 'Configurações', 3),
('whatsapp_settings', 'WhatsApp', 'Configurar WhatsApp', 'Configurações', 4),
('manage_settings', 'Configurações Gerais', 'Acesso às configurações', 'Configurações', 5),

-- Consulta/Visualização
('view_schedules', 'Agendas', 'Consultar agendas', 'Consulta', 1),
('view_audit', 'Auditoria', 'Ver logs de auditoria', 'Consulta', 2),
('view_commissions', 'Comissões', 'Ver comissões', 'Consulta', 3),
('view_stock', 'Estoque', 'Ver estoque', 'Consulta', 4),
('view_budgets', 'Orçamentos', 'Ver orçamentos', 'Consulta', 5),

-- Dashboard
('dashboard_financial', 'Dashboard Financeiro', 'Ver dashboard financeiro', 'Dashboard', 1),
('dashboard_charts', 'Gráficos', 'Ver gráficos do dashboard', 'Dashboard', 2),
('dashboard_default', 'Dashboard Padrão', 'Ver dashboard padrão', 'Dashboard', 3),
('view_dashboard', 'Visualizar Dashboard', 'Acesso ao dashboard', 'Dashboard', 4),

-- Financeiro
('financial_categories', 'Categorias Financeiras', 'Gerenciar categorias', 'Financeiro', 1),
('financial_accounts', 'Contas', 'Gerenciar contas bancárias', 'Financeiro', 2),
('view_financials', 'Visualizar Financeiro', 'Ver módulo financeiro', 'Financeiro', 3),
('manage_financials', 'Gerenciar Financeiro', 'Criar/editar lançamentos', 'Financeiro', 4),
('receivables', 'Contas a Receber', 'Gerenciar contas a receber', 'Financeiro', 5),
('payables', 'Contas a Pagar', 'Gerenciar contas a pagar', 'Financeiro', 6),

-- Lista de Espera
('manage_waiting_list', 'Lista de Espera', 'Gerenciar lista de espera', 'Lista de Espera', 1),

-- Permissões
('access_groups', 'Grupos de Acesso', 'Gerenciar grupos de acesso', 'Permissões', 1),
('manage_users', 'Gerenciar Usuários', 'Gerenciar usuários da clínica', 'Permissões', 2),

-- Produtos e Serviços
('view_procedures', 'Visualizar Procedimentos', 'Ver procedimentos', 'Produtos e Serviços', 1),
('manage_procedures', 'Gerenciar Procedimentos', 'Criar/editar procedimentos', 'Produtos e Serviços', 2),
('manage_stock', 'Gerenciar Estoque', 'Gerenciar estoque', 'Produtos e Serviços', 3),

-- Profissional
('manage_professionals', 'Gerenciar Profissionais', 'Criar/editar profissionais', 'Profissional', 1),
('view_professional_schedule', 'Ver Agenda Profissional', 'Ver agenda do profissional', 'Profissional', 2),

-- Prontuário
('view_medical_records', 'Visualizar Prontuário', 'Ver prontuários', 'Prontuário', 1),
('manage_medical_records', 'Gerenciar Prontuário', 'Criar/editar prontuários', 'Prontuário', 2),
('view_prescriptions', 'Visualizar Prescrições', 'Ver prescrições', 'Prontuário', 3),
('manage_prescriptions', 'Gerenciar Prescrições', 'Criar/editar prescrições', 'Prontuário', 4),
('view_anamnesis', 'Visualizar Anamnese', 'Ver anamneses', 'Prontuário', 5),
('manage_anamnesis', 'Gerenciar Anamnese', 'Criar/editar anamneses', 'Prontuário', 6),
('manage_anamnesis_templates', 'Templates de Anamnese', 'Gerenciar templates', 'Prontuário', 7),

-- Assinatura
('manage_subscription', 'Gerenciar Assinatura', 'Gerenciar plano e assinatura', 'Assinatura', 1);

-- Criar grupos de acesso padrão do sistema (globais)
INSERT INTO public.access_groups (clinic_id, name, description, is_system, is_active) VALUES
(NULL, 'Administrador', 'Acesso total ao sistema', true, true),
(NULL, 'Profissional', 'Acesso para profissionais de saúde', true, true),
(NULL, 'Recepcionista', 'Acesso para recepção e atendimento', true, true),
(NULL, 'Administrativo', 'Acesso para funções administrativas', true, true);

-- Inserir permissões para grupo Profissional
INSERT INTO public.access_group_permissions (access_group_id, permission_key)
SELECT ag.id, pd.key
FROM public.access_groups ag
CROSS JOIN public.permission_definitions pd
WHERE ag.name = 'Profissional' AND ag.is_system = true
AND pd.key IN (
  'view_dashboard', 'dashboard_default', 'view_calendar', 'manage_calendar',
  'view_patients', 'view_medical_records', 'manage_medical_records',
  'view_prescriptions', 'manage_prescriptions', 'view_anamnesis', 'manage_anamnesis',
  'view_procedures'
);

-- Inserir permissões para grupo Recepcionista
INSERT INTO public.access_group_permissions (access_group_id, permission_key)
SELECT ag.id, pd.key
FROM public.access_groups ag
CROSS JOIN public.permission_definitions pd
WHERE ag.name = 'Recepcionista' AND ag.is_system = true
AND pd.key IN (
  'view_dashboard', 'dashboard_default', 'scheduling', 'view_calendar', 'manage_calendar',
  'view_patients', 'manage_patients', 'view_anamnesis', 'manage_anamnesis',
  'manage_waiting_list', 'view_procedures'
);

-- Inserir permissões para grupo Administrativo
INSERT INTO public.access_group_permissions (access_group_id, permission_key)
SELECT ag.id, pd.key
FROM public.access_groups ag
CROSS JOIN public.permission_definitions pd
WHERE ag.name = 'Administrativo' AND ag.is_system = true
AND pd.key IN (
  'view_dashboard', 'dashboard_default', 'dashboard_financial', 'dashboard_charts',
  'scheduling', 'view_calendar', 'manage_calendar',
  'view_patients', 'manage_patients', 'view_anamnesis', 'manage_anamnesis',
  'manage_waiting_list', 'insurance_plans', 'view_reports',
  'view_procedures', 'view_financials'
);