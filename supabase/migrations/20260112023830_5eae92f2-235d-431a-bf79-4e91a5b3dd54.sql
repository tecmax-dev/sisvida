-- 1. Adicionar colunas de gestão sindical na tabela patients
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS is_union_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS union_member_status text CHECK (union_member_status IN ('pendente', 'ativo', 'inativo', 'suspenso')) DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS union_category_id uuid,
ADD COLUMN IF NOT EXISTS union_joined_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS union_contribution_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS union_payment_method text,
ADD COLUMN IF NOT EXISTS union_observations text;

-- 2. Índice para consultas de sócios
CREATE INDEX IF NOT EXISTS idx_patients_union_member ON public.patients(clinic_id, is_union_member) WHERE is_union_member = true;

-- 3. Função para verificar contexto sindical
CREATE OR REPLACE FUNCTION public.is_union_context(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = p_user_id
    AND ur.role = 'entidade_sindical_admin'
    AND ur.clinic_id IS NULL
  )
$$;

-- 4. Tabela de auditoria para ações sindicais
CREATE TABLE public.union_member_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid,
  performed_at timestamp with time zone DEFAULT now(),
  module_origin text DEFAULT 'sindical'
);

-- 5. Índices para auditoria
CREATE INDEX idx_union_member_audit_clinic ON public.union_member_audit_logs(clinic_id);
CREATE INDEX idx_union_member_audit_patient ON public.union_member_audit_logs(patient_id);
CREATE INDEX idx_union_member_audit_date ON public.union_member_audit_logs(performed_at DESC);

-- 6. RLS para auditoria
ALTER TABLE public.union_member_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para tabela de auditoria - usando has_clinic_access apenas
CREATE POLICY "View union member audit logs"
ON public.union_member_audit_logs
FOR SELECT
TO authenticated
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Insert union member audit logs"
ON public.union_member_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (has_clinic_access(auth.uid(), clinic_id));