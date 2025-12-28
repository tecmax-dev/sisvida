
-- ============================================================
-- CORREÇÃO DE SEGURANÇA: Atualizar funções de permissão
-- ============================================================

-- Atualizar a função get_user_permissions para validar contra o plano
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid, _clinic_id uuid)
RETURNS TABLE(permission_key text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Se for super admin, retorna todas as permissões
  SELECT pd.key
  FROM public.permission_definitions pd
  WHERE pd.is_active = true
  AND EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
  
  UNION
  
  -- Se for owner ou admin (sem grupo de acesso específico), retorna permissões do plano
  SELECT DISTINCT pd.key
  FROM public.permission_definitions pd
  WHERE pd.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND ur.clinic_id = _clinic_id
    AND ur.role IN ('owner', 'admin')
    AND ur.access_group_id IS NULL
  )
  AND (
    EXISTS (
      SELECT 1 
      FROM public.feature_permissions fp
      JOIN public.plan_features pf ON pf.feature_id = fp.feature_id
      JOIN public.subscriptions s ON s.plan_id = pf.plan_id
      WHERE fp.permission_key = pd.key
      AND s.clinic_id = _clinic_id
      AND s.status IN ('active', 'trial')
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM public.feature_permissions fp WHERE fp.permission_key = pd.key
    )
  )
  
  UNION
  
  -- Retorna permissões do grupo de acesso (filtradas pelo plano)
  SELECT DISTINCT agp.permission_key
  FROM public.user_roles ur
  JOIN public.access_group_permissions agp ON agp.access_group_id = ur.access_group_id
  JOIN public.permission_definitions pd ON pd.key = agp.permission_key AND pd.is_active = true
  WHERE ur.user_id = _user_id
  AND ur.clinic_id = _clinic_id
  AND (
    EXISTS (
      SELECT 1 
      FROM public.feature_permissions fp
      JOIN public.plan_features pf ON pf.feature_id = fp.feature_id
      JOIN public.subscriptions s ON s.plan_id = pf.plan_id
      WHERE fp.permission_key = agp.permission_key
      AND s.clinic_id = _clinic_id
      AND s.status IN ('active', 'trial')
    )
    OR
    NOT EXISTS (
      SELECT 1 FROM public.feature_permissions fp WHERE fp.permission_key = agp.permission_key
    )
  )
$$;

-- Atualizar a função user_has_permission
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _clinic_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.user_roles ur
    JOIN public.permission_definitions pd ON pd.key = _permission_key AND pd.is_active = true
    WHERE ur.user_id = _user_id
    AND ur.clinic_id = _clinic_id
    AND ur.role IN ('owner', 'admin')
    AND ur.access_group_id IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.feature_permissions fp
        JOIN public.plan_features pf ON pf.feature_id = fp.feature_id
        JOIN public.subscriptions s ON s.plan_id = pf.plan_id
        WHERE fp.permission_key = _permission_key
        AND s.clinic_id = _clinic_id AND s.status IN ('active', 'trial')
      )
      OR
      NOT EXISTS (SELECT 1 FROM public.feature_permissions fp WHERE fp.permission_key = _permission_key)
    )
    UNION ALL
    SELECT 1 FROM public.user_roles ur
    JOIN public.access_group_permissions agp ON agp.access_group_id = ur.access_group_id
    WHERE ur.user_id = _user_id
    AND ur.clinic_id = _clinic_id
    AND agp.permission_key = _permission_key
    AND (
      EXISTS (
        SELECT 1 FROM public.feature_permissions fp
        JOIN public.plan_features pf ON pf.feature_id = fp.feature_id
        JOIN public.subscriptions s ON s.plan_id = pf.plan_id
        WHERE fp.permission_key = _permission_key
        AND s.clinic_id = _clinic_id AND s.status IN ('active', 'trial')
      )
      OR
      NOT EXISTS (SELECT 1 FROM public.feature_permissions fp WHERE fp.permission_key = _permission_key)
    )
  )
$$;

-- Função para obter permissões disponíveis para uma clínica
CREATE OR REPLACE FUNCTION public.get_available_permissions_for_clinic(_clinic_id uuid)
RETURNS TABLE(permission_key text, permission_name text, category text, feature_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT pd.key AS permission_key, pd.name AS permission_name, pd.category, NULL::text AS feature_name
  FROM public.permission_definitions pd
  WHERE pd.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.feature_permissions fp WHERE fp.permission_key = pd.key
  )
  
  UNION
  
  SELECT DISTINCT pd.key AS permission_key, pd.name AS permission_name, pd.category, sf.name AS feature_name
  FROM public.permission_definitions pd
  JOIN public.feature_permissions fp ON fp.permission_key = pd.key
  JOIN public.plan_features pf ON pf.feature_id = fp.feature_id
  JOIN public.subscriptions s ON s.plan_id = pf.plan_id
  JOIN public.system_features sf ON sf.id = fp.feature_id
  WHERE pd.is_active = true
  AND s.clinic_id = _clinic_id
  AND s.status IN ('active', 'trial')
  
  ORDER BY category, permission_name;
END;
$$;

-- Comentários
COMMENT ON FUNCTION public.get_user_permissions IS 'Retorna as permissões efetivas de um usuário, respeitando o plano contratado pela clínica';
COMMENT ON FUNCTION public.user_has_permission IS 'Verifica se um usuário tem uma permissão específica, respeitando o plano da clínica';
COMMENT ON FUNCTION public.get_available_permissions_for_clinic IS 'Retorna todas as permissões disponíveis para uma clínica baseado no seu plano';
