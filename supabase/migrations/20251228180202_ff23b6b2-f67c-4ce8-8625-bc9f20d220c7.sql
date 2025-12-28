
-- ============================================================
-- CORREÇÃO DE SEGURANÇA: Vincular permissões aos recursos do plano
-- Parte 1: Criar tabela feature_permissions
-- ============================================================

-- 1. Criar tabela que vincula system_features a permission_definitions
CREATE TABLE IF NOT EXISTS public.feature_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES public.system_features(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feature_id, permission_key)
);

-- Habilitar RLS
ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (dados de configuração do sistema)
CREATE POLICY "Feature permissions are readable by authenticated users"
ON public.feature_permissions
FOR SELECT
TO authenticated
USING (true);

-- Apenas super admins podem modificar
CREATE POLICY "Only super admins can manage feature permissions"
ON public.feature_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
);

-- Adicionar comentário
COMMENT ON TABLE public.feature_permissions IS 'Vincula recursos do sistema (system_features) às permissões que eles liberam (permission_definitions)';
