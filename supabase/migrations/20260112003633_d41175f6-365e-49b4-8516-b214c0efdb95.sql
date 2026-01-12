-- ================================================================
-- MIGRAÇÃO DE SEGURANÇA: Adicionar search_path e melhorias
-- ================================================================

-- 1. Criar nova função de acesso para entidades sindicais
-- ================================================================
CREATE OR REPLACE FUNCTION public.has_union_entity_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.union_entities
    WHERE user_id = _user_id AND status = 'ativa'
  )
  OR EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
  )
$$;

-- 2. Corrigir policy de anamnese_responses  
-- ================================================================
DROP POLICY IF EXISTS "Public can update anamnesis via token" ON public.anamnese_responses;
CREATE POLICY "Public can update anamnesis via token"
ON public.anamnese_responses
FOR UPDATE
USING (public_token IS NOT NULL)
WITH CHECK (public_token IS NOT NULL);

-- 3. Adicionar política para user_roles com entidades sindicais
-- ================================================================
DROP POLICY IF EXISTS "Union entity admins can view their role" ON public.user_roles;
CREATE POLICY "Union entity admins can view their role"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid() 
  AND role = 'entidade_sindical_admin'
  AND clinic_id IS NULL
);

-- 4. Criar índices para performance (se não existirem)
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_union_entities_user_id ON public.union_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_union_entities_status ON public.union_entities(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_union_entity ON public.user_roles(user_id) WHERE role = 'entidade_sindical_admin';

-- 5. Garantir que a permissão union_module_access existe na tabela de definições
-- ================================================================
INSERT INTO public.permission_definitions (key, name, description, category)
VALUES ('union_module_access', 'Acesso ao Módulo Sindical', 'Permite acessar o módulo sindical e suas funcionalidades', 'Módulo Sindical')
ON CONFLICT (key) DO NOTHING;

-- 6. Documentação das funções
-- ================================================================
COMMENT ON FUNCTION public.has_union_entity_access IS 'Verifica se um usuário tem acesso como entidade sindical independente (vinculado a union_entities com status ativa) ou é super admin';