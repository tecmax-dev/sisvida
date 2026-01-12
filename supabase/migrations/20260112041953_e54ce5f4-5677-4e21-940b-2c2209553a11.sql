-- ============================================
-- Vinculação de Empresas e Escritórios ao Módulo Sindical
-- ============================================

-- 1. Adicionar coluna union_entity_id para employers
ALTER TABLE public.employers 
ADD COLUMN IF NOT EXISTS union_entity_id uuid REFERENCES public.union_entities(id) ON DELETE SET NULL;

-- 2. Adicionar coluna union_entity_id para accounting_offices
ALTER TABLE public.accounting_offices 
ADD COLUMN IF NOT EXISTS union_entity_id uuid REFERENCES public.union_entities(id) ON DELETE SET NULL;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_employers_union_entity_id 
ON public.employers(union_entity_id) WHERE union_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_offices_union_entity_id 
ON public.accounting_offices(union_entity_id) WHERE union_entity_id IS NOT NULL;

-- 4. Migrar dados existentes: vincular ao sindicato da clínica
-- Empresas
UPDATE public.employers e
SET union_entity_id = (
  SELECT ue.id 
  FROM public.union_entities ue 
  WHERE ue.clinic_id = e.clinic_id 
  LIMIT 1
)
WHERE e.union_entity_id IS NULL 
AND EXISTS (
  SELECT 1 FROM public.union_entities ue WHERE ue.clinic_id = e.clinic_id
);

-- Escritórios
UPDATE public.accounting_offices ao
SET union_entity_id = (
  SELECT ue.id 
  FROM public.union_entities ue 
  WHERE ue.clinic_id = ao.clinic_id 
  LIMIT 1
)
WHERE ao.union_entity_id IS NULL 
AND EXISTS (
  SELECT 1 FROM public.union_entities ue WHERE ue.clinic_id = ao.clinic_id
);

-- 5. Função auxiliar para verificar acesso à entidade sindical
CREATE OR REPLACE FUNCTION public.has_union_entity_access(
  _user_id uuid,
  _union_entity_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.union_entities ue
    WHERE ue.id = _union_entity_id
    AND (
      -- Usuário é admin da entidade
      ue.user_id = _user_id
      OR
      -- Usuário tem role entidade_sindical_admin e está vinculado à mesma entidade
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _user_id
        AND ur.role = 'entidade_sindical_admin'
        AND ur.clinic_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.union_entities ue2
          WHERE ue2.user_id = _user_id
          AND ue2.id = _union_entity_id
        )
      )
      OR
      -- Usuário tem acesso à clínica vinculada
      (ue.clinic_id IS NOT NULL AND has_clinic_access(_user_id, ue.clinic_id))
    )
  )
$$;

-- 6. Tabela de logs para compartilhamento de link de filiação
CREATE TABLE IF NOT EXISTS public.union_share_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  union_entity_id uuid NOT NULL REFERENCES public.union_entities(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  message_sent text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.union_share_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para union_share_logs
CREATE POLICY "Union admins can view share logs"
ON public.union_share_logs
FOR SELECT
USING (
  has_union_entity_access(auth.uid(), union_entity_id)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Union admins can insert share logs"
ON public.union_share_logs
FOR INSERT
WITH CHECK (
  has_union_entity_access(auth.uid(), union_entity_id)
  OR is_super_admin(auth.uid())
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_union_share_logs_entity 
ON public.union_share_logs(union_entity_id);

CREATE INDEX IF NOT EXISTS idx_union_share_logs_sent_at 
ON public.union_share_logs(sent_at DESC);