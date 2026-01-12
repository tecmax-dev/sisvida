-- Adicionar coluna module_type na tabela access_groups para separar grupos de Clínica e Sindical
ALTER TABLE public.access_groups 
ADD COLUMN IF NOT EXISTS module_type text DEFAULT 'clinic' CHECK (module_type IN ('clinic', 'union', 'all'));

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.access_groups.module_type IS 'Tipo de módulo: clinic (Clínica), union (Módulo Sindical), all (Todos)';

-- Adicionar coluna module_type na tabela permission_definitions
ALTER TABLE public.permission_definitions 
ADD COLUMN IF NOT EXISTS module_type text DEFAULT 'clinic' CHECK (module_type IN ('clinic', 'union'));

-- Atualizar permissões do Módulo Sindical para terem module_type = 'union'
UPDATE public.permission_definitions 
SET module_type = 'union' 
WHERE key LIKE 'union_%' OR category = 'Módulo Sindical';

-- Atualizar grupos de acesso existentes baseados em suas permissões
-- Grupos que só têm permissões de clínica ficam como 'clinic'
-- Grupos que só têm permissões sindicais ficam como 'union'

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_access_groups_module_type ON public.access_groups(module_type);
CREATE INDEX IF NOT EXISTS idx_permission_definitions_module_type ON public.permission_definitions(module_type);

-- Atualizar as categorias de permissões do Módulo Sindical para subcategorias mais específicas
UPDATE public.permission_definitions 
SET category = 'Sindical - Empresas'
WHERE key IN ('union_view_employers', 'union_manage_employers', 'union_delete_employers');

UPDATE public.permission_definitions 
SET category = 'Sindical - Sócios'
WHERE key IN ('union_view_members', 'union_manage_members');

UPDATE public.permission_definitions 
SET category = 'Sindical - Contribuições'
WHERE key IN ('union_view_contributions', 'union_manage_contributions', 'union_generate_boletos', 'union_send_boleto_whatsapp', 'union_send_boleto_email', 'union_view_contribution_reports');

UPDATE public.permission_definitions 
SET category = 'Sindical - Financeiro'
WHERE key IN ('union_view_financials', 'union_manage_financials', 'union_view_expenses', 'union_manage_expenses', 'union_view_income', 'union_manage_income', 'union_view_cash_flow', 'union_manage_cash_registers', 'union_manage_suppliers', 'union_generate_reports', 'union_reversal', 'union_manage_categories', 'union_manage_cost_centers');

UPDATE public.permission_definitions 
SET category = 'Sindical - Negociações'
WHERE key IN ('union_view_negotiations', 'union_manage_negotiations', 'union_approve_negotiations', 'union_view_agreements', 'union_view_installments');

UPDATE public.permission_definitions 
SET category = 'Sindical - Auditoria'
WHERE key IN ('union_view_audit');

UPDATE public.permission_definitions 
SET category = 'Sindical - Geral'
WHERE key = 'union_module_access';