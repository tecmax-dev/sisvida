-- =====================================================
-- GRUPOS DE ACESSO PRÉ-CONFIGURADOS (SISTEMA)
-- Estes grupos servem como template para clínicas
-- =====================================================

-- 1. RECEPCIONISTA
-- Foco: Atendimento ao paciente, agendamento, cadastros básicos
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000001-0000-0000-0000-000000000001',
  'Recepcionista',
  'Atendimento ao paciente, agendamento e cadastros básicos. Sem acesso ao financeiro.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões da Recepcionista
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard
  ('a0000001-0000-0000-0000-000000000001', 'view_dashboard'),
  ('a0000001-0000-0000-0000-000000000001', 'dashboard_default'),
  -- Agenda
  ('a0000001-0000-0000-0000-000000000001', 'scheduling'),
  ('a0000001-0000-0000-0000-000000000001', 'view_calendar'),
  ('a0000001-0000-0000-0000-000000000001', 'manage_calendar'),
  ('a0000001-0000-0000-0000-000000000001', 'view_waiting_list'),
  ('a0000001-0000-0000-0000-000000000001', 'manage_waiting_list'),
  ('a0000001-0000-0000-0000-000000000001', 'view_schedules'),
  -- Fila de atendimento
  ('a0000001-0000-0000-0000-000000000001', 'view_queue'),
  ('a0000001-0000-0000-0000-000000000001', 'manage_queue'),
  -- Pacientes (sem excluir e sem desbloquear)
  ('a0000001-0000-0000-0000-000000000001', 'view_patients'),
  ('a0000001-0000-0000-0000-000000000001', 'manage_patients'),
  ('a0000001-0000-0000-0000-000000000001', 'view_attachments'),
  -- Anamnese
  ('a0000001-0000-0000-0000-000000000001', 'view_anamnesis'),
  ('a0000001-0000-0000-0000-000000000001', 'manage_anamnesis'),
  ('a0000001-0000-0000-0000-000000000001', 'send_anamnesis_whatsapp'),
  ('a0000001-0000-0000-0000-000000000001', 'view_anamnesis_templates'),
  ('a0000001-0000-0000-0000-000000000001', 'anamnesis_forms'),
  -- Prontuário (apenas leitura)
  ('a0000001-0000-0000-0000-000000000001', 'view_medical_records'),
  -- Procedimentos
  ('a0000001-0000-0000-0000-000000000001', 'view_procedures'),
  ('a0000001-0000-0000-0000-000000000001', 'view_catalog'),
  -- Orçamentos (sem aprovar)
  ('a0000001-0000-0000-0000-000000000001', 'view_budgets'),
  ('a0000001-0000-0000-0000-000000000001', 'manage_budgets'),
  ('a0000001-0000-0000-0000-000000000001', 'send_budget_whatsapp'),
  -- Convênios
  ('a0000001-0000-0000-0000-000000000001', 'insurance_plans'),
  -- Pacotes
  ('a0000001-0000-0000-0000-000000000001', 'view_packages'),
  -- Configurações pessoais
  ('a0000001-0000-0000-0000-000000000001', 'change_password')
ON CONFLICT DO NOTHING;

-- 2. PROFISSIONAL DE SAÚDE
-- Foco: Atendimento clínico, prontuário, prescrições (agenda própria apenas)
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000002-0000-0000-0000-000000000002',
  'Profissional de Saúde',
  'Acesso à própria agenda, prontuário e prescrições. Sem acesso a listagem de pacientes ou financeiro.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões do Profissional
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard
  ('a0000002-0000-0000-0000-000000000002', 'view_dashboard'),
  ('a0000002-0000-0000-0000-000000000002', 'dashboard_default'),
  -- Agenda (própria)
  ('a0000002-0000-0000-0000-000000000002', 'scheduling'),
  ('a0000002-0000-0000-0000-000000000002', 'view_calendar'),
  ('a0000002-0000-0000-0000-000000000002', 'view_professional_schedule'),
  -- Prontuário
  ('a0000002-0000-0000-0000-000000000002', 'view_medical_records'),
  ('a0000002-0000-0000-0000-000000000002', 'manage_medical_records'),
  -- Anamnese (leitura)
  ('a0000002-0000-0000-0000-000000000002', 'view_anamnesis'),
  -- Prescrições
  ('a0000002-0000-0000-0000-000000000002', 'view_prescriptions'),
  ('a0000002-0000-0000-0000-000000000002', 'manage_prescriptions'),
  -- Configurações pessoais
  ('a0000002-0000-0000-0000-000000000002', 'change_password')
ON CONFLICT DO NOTHING;

-- 3. ADMINISTRATIVO/FINANCEIRO
-- Foco: Financeiro, relatórios, gestão operacional
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000003-0000-0000-0000-000000000003',
  'Administrativo/Financeiro',
  'Gestão financeira, relatórios e operações administrativas. Sem acesso a prontuário.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões do Administrativo/Financeiro
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard completo
  ('a0000003-0000-0000-0000-000000000003', 'view_dashboard'),
  ('a0000003-0000-0000-0000-000000000003', 'dashboard_default'),
  ('a0000003-0000-0000-0000-000000000003', 'dashboard_financial'),
  ('a0000003-0000-0000-0000-000000000003', 'dashboard_charts'),
  -- Agenda (visualização)
  ('a0000003-0000-0000-0000-000000000003', 'scheduling'),
  ('a0000003-0000-0000-0000-000000000003', 'view_calendar'),
  ('a0000003-0000-0000-0000-000000000003', 'view_schedules'),
  ('a0000003-0000-0000-0000-000000000003', 'view_waiting_list'),
  -- Pacientes (sem excluir)
  ('a0000003-0000-0000-0000-000000000003', 'view_patients'),
  ('a0000003-0000-0000-0000-000000000003', 'manage_patients'),
  -- Financeiro completo
  ('a0000003-0000-0000-0000-000000000003', 'view_financials'),
  ('a0000003-0000-0000-0000-000000000003', 'manage_financials'),
  ('a0000003-0000-0000-0000-000000000003', 'financial_categories'),
  ('a0000003-0000-0000-0000-000000000003', 'financial_accounts'),
  ('a0000003-0000-0000-0000-000000000003', 'receivables'),
  ('a0000003-0000-0000-0000-000000000003', 'payables'),
  ('a0000003-0000-0000-0000-000000000003', 'recurring_transactions'),
  ('a0000003-0000-0000-0000-000000000003', 'cashier'),
  ('a0000003-0000-0000-0000-000000000003', 'manage_cashier'),
  ('a0000003-0000-0000-0000-000000000003', 'cash_flow_monthly'),
  ('a0000003-0000-0000-0000-000000000003', 'cash_flow_annual'),
  ('a0000003-0000-0000-0000-000000000003', 'view_commissions'),
  -- Relatórios
  ('a0000003-0000-0000-0000-000000000003', 'view_reports'),
  -- Orçamentos completo
  ('a0000003-0000-0000-0000-000000000003', 'view_budgets'),
  ('a0000003-0000-0000-0000-000000000003', 'manage_budgets'),
  ('a0000003-0000-0000-0000-000000000003', 'send_budget_whatsapp'),
  ('a0000003-0000-0000-0000-000000000003', 'approve_budgets'),
  ('a0000003-0000-0000-0000-000000000003', 'convert_budgets'),
  -- Convênios
  ('a0000003-0000-0000-0000-000000000003', 'insurance_plans'),
  -- Estoque
  ('a0000003-0000-0000-0000-000000000003', 'view_stock'),
  ('a0000003-0000-0000-0000-000000000003', 'manage_stock'),
  -- Catálogo
  ('a0000003-0000-0000-0000-000000000003', 'view_catalog'),
  ('a0000003-0000-0000-0000-000000000003', 'manage_catalog'),
  -- Configurações pessoais
  ('a0000003-0000-0000-0000-000000000003', 'change_password')
ON CONFLICT DO NOTHING;

-- 4. ATENDENTE (mais restrito que Recepcionista)
-- Foco: Apenas agenda e fila de atendimento
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000004-0000-0000-0000-000000000004',
  'Atendente',
  'Acesso básico apenas à agenda e fila de atendimento. Sem acesso a cadastros de pacientes.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões do Atendente
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard
  ('a0000004-0000-0000-0000-000000000004', 'view_dashboard'),
  ('a0000004-0000-0000-0000-000000000004', 'dashboard_default'),
  -- Agenda
  ('a0000004-0000-0000-0000-000000000004', 'scheduling'),
  ('a0000004-0000-0000-0000-000000000004', 'view_calendar'),
  ('a0000004-0000-0000-0000-000000000004', 'manage_calendar'),
  ('a0000004-0000-0000-0000-000000000004', 'view_waiting_list'),
  ('a0000004-0000-0000-0000-000000000004', 'view_schedules'),
  -- Fila de atendimento
  ('a0000004-0000-0000-0000-000000000004', 'view_queue'),
  ('a0000004-0000-0000-0000-000000000004', 'manage_queue'),
  -- Pacientes (apenas visualização)
  ('a0000004-0000-0000-0000-000000000004', 'view_patients'),
  -- Configurações pessoais
  ('a0000004-0000-0000-0000-000000000004', 'change_password')
ON CONFLICT DO NOTHING;

-- 5. GESTÃO DE ESTOQUE
-- Foco: Controle de estoque e fornecedores
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000005-0000-0000-0000-000000000005',
  'Gestão de Estoque',
  'Controle de estoque, produtos e fornecedores. Sem acesso a financeiro ou pacientes.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões de Gestão de Estoque
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard
  ('a0000005-0000-0000-0000-000000000005', 'view_dashboard'),
  ('a0000005-0000-0000-0000-000000000005', 'dashboard_default'),
  -- Estoque completo
  ('a0000005-0000-0000-0000-000000000005', 'view_stock'),
  ('a0000005-0000-0000-0000-000000000005', 'manage_stock'),
  -- Catálogo
  ('a0000005-0000-0000-0000-000000000005', 'view_catalog'),
  ('a0000005-0000-0000-0000-000000000005', 'manage_catalog'),
  -- Configurações pessoais
  ('a0000005-0000-0000-0000-000000000005', 'change_password')
ON CONFLICT DO NOTHING;

-- 6. MARKETING
-- Foco: Campanhas, segmentos, automações
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000006-0000-0000-0000-000000000006',
  'Marketing',
  'Gestão de campanhas, segmentos e automações de marketing. Acesso a pacientes apenas para segmentação.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões de Marketing
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard
  ('a0000006-0000-0000-0000-000000000006', 'view_dashboard'),
  ('a0000006-0000-0000-0000-000000000006', 'dashboard_default'),
  -- Pacientes (apenas visualização para segmentação)
  ('a0000006-0000-0000-0000-000000000006', 'view_patients'),
  -- Marketing completo
  ('a0000006-0000-0000-0000-000000000006', 'view_marketing'),
  ('a0000006-0000-0000-0000-000000000006', 'manage_marketing'),
  ('a0000006-0000-0000-0000-000000000006', 'view_campaigns'),
  ('a0000006-0000-0000-0000-000000000006', 'manage_campaigns'),
  ('a0000006-0000-0000-0000-000000000006', 'view_automations'),
  ('a0000006-0000-0000-0000-000000000006', 'manage_automations'),
  ('a0000006-0000-0000-0000-000000000006', 'view_segments'),
  ('a0000006-0000-0000-0000-000000000006', 'manage_segments'),
  -- Configurações pessoais
  ('a0000006-0000-0000-0000-000000000006', 'change_password')
ON CONFLICT DO NOTHING;

-- 7. RECEPCIONISTA SÊNIOR
-- Foco: Recepcionista com permissão de desbloquear pacientes
INSERT INTO access_groups (id, name, description, clinic_id, is_system, is_active)
VALUES (
  'a0000007-0000-0000-0000-000000000007',
  'Recepcionista Sênior',
  'Recepcionista com permissões extras: desbloquear pacientes, aprovar orçamentos.',
  NULL,
  true,
  true
) ON CONFLICT (id) DO NOTHING;

-- Permissões da Recepcionista Sênior (todas da recepcionista + extras)
INSERT INTO access_group_permissions (access_group_id, permission_key) VALUES
  -- Dashboard
  ('a0000007-0000-0000-0000-000000000007', 'view_dashboard'),
  ('a0000007-0000-0000-0000-000000000007', 'dashboard_default'),
  -- Agenda
  ('a0000007-0000-0000-0000-000000000007', 'scheduling'),
  ('a0000007-0000-0000-0000-000000000007', 'view_calendar'),
  ('a0000007-0000-0000-0000-000000000007', 'manage_calendar'),
  ('a0000007-0000-0000-0000-000000000007', 'view_waiting_list'),
  ('a0000007-0000-0000-0000-000000000007', 'manage_waiting_list'),
  ('a0000007-0000-0000-0000-000000000007', 'view_schedules'),
  -- Fila de atendimento
  ('a0000007-0000-0000-0000-000000000007', 'view_queue'),
  ('a0000007-0000-0000-0000-000000000007', 'manage_queue'),
  -- Pacientes (com desbloqueio!)
  ('a0000007-0000-0000-0000-000000000007', 'view_patients'),
  ('a0000007-0000-0000-0000-000000000007', 'manage_patients'),
  ('a0000007-0000-0000-0000-000000000007', 'view_attachments'),
  ('a0000007-0000-0000-0000-000000000007', 'unblock_patients'),
  -- Anamnese
  ('a0000007-0000-0000-0000-000000000007', 'view_anamnesis'),
  ('a0000007-0000-0000-0000-000000000007', 'manage_anamnesis'),
  ('a0000007-0000-0000-0000-000000000007', 'send_anamnesis_whatsapp'),
  ('a0000007-0000-0000-0000-000000000007', 'view_anamnesis_templates'),
  ('a0000007-0000-0000-0000-000000000007', 'anamnesis_forms'),
  -- Prontuário (apenas leitura)
  ('a0000007-0000-0000-0000-000000000007', 'view_medical_records'),
  -- Procedimentos
  ('a0000007-0000-0000-0000-000000000007', 'view_procedures'),
  ('a0000007-0000-0000-0000-000000000007', 'view_catalog'),
  -- Orçamentos (com aprovação!)
  ('a0000007-0000-0000-0000-000000000007', 'view_budgets'),
  ('a0000007-0000-0000-0000-000000000007', 'manage_budgets'),
  ('a0000007-0000-0000-0000-000000000007', 'send_budget_whatsapp'),
  ('a0000007-0000-0000-0000-000000000007', 'approve_budgets'),
  -- Convênios
  ('a0000007-0000-0000-0000-000000000007', 'insurance_plans'),
  -- Pacotes
  ('a0000007-0000-0000-0000-000000000007', 'view_packages'),
  -- Configurações pessoais
  ('a0000007-0000-0000-0000-000000000007', 'change_password')
ON CONFLICT DO NOTHING;