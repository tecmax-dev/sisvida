
-- =====================================================================
-- Migração: Fluxo Financeiro Completo para Contribuições Lytex
-- Adiciona campos para taxas, conciliação, auditoria e rastreabilidade
-- =====================================================================

-- 1. Adicionar novas colunas à tabela employer_contributions
ALTER TABLE public.employer_contributions 
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'manual' CHECK (origin IN ('manual', 'lytex', 'import')),
ADD COLUMN IF NOT EXISTS union_entity_id uuid REFERENCES public.union_entities(id),
ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.patients(id),
ADD COLUMN IF NOT EXISTS lytex_transaction_id text,
ADD COLUMN IF NOT EXISTS lytex_fee_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS lytex_fee_details jsonb,
ADD COLUMN IF NOT EXISTS net_value integer,
ADD COLUMN IF NOT EXISTS is_reconciled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reconciled_by uuid,
ADD COLUMN IF NOT EXISTS reconciliation_notes text,
ADD COLUMN IF NOT EXISTS has_divergence boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS divergence_details jsonb,
ADD COLUMN IF NOT EXISTS financial_category_id uuid,
ADD COLUMN IF NOT EXISTS cash_register_id uuid,
ADD COLUMN IF NOT EXISTS imported_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS lytex_raw_data jsonb,
ADD COLUMN IF NOT EXISTS is_editable boolean DEFAULT true;

-- 2. Criar tabela de histórico/auditoria de contribuições
CREATE TABLE IF NOT EXISTS public.contribution_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id uuid NOT NULL REFERENCES public.employer_contributions(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  action text NOT NULL CHECK (action IN ('created', 'imported', 'invoice_generated', 'status_changed', 'reconciled', 'value_adjusted', 'cancelled', 'reversed', 'edited', 'synced')),
  previous_status text,
  new_status text,
  previous_value integer,
  new_value integer,
  previous_data jsonb,
  new_data jsonb,
  notes text,
  performed_by uuid,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- 3. Habilitar RLS na tabela de auditoria
ALTER TABLE public.contribution_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de RLS para auditoria
CREATE POLICY "Clinic users can view contribution audit logs"
ON public.contribution_audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.clinic_id = contribution_audit_logs.clinic_id
  )
  OR EXISTS (
    SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert contribution audit logs"
ON public.contribution_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.clinic_id = contribution_audit_logs.clinic_id
  )
  OR EXISTS (
    SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()
  )
);

-- 5. Função para registrar auditoria automaticamente
CREATE OR REPLACE FUNCTION public.log_contribution_change()
RETURNS trigger AS $$
BEGIN
  -- Apenas registrar mudanças significativas
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contribution_audit_logs (
      contribution_id, clinic_id, action, new_status, new_value, new_data, performed_by
    ) VALUES (
      NEW.id, NEW.clinic_id, 'created', NEW.status, NEW.value,
      jsonb_build_object(
        'due_date', NEW.due_date,
        'origin', NEW.origin,
        'contribution_type_id', NEW.contribution_type_id
      ),
      NEW.created_by
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Registrar mudança de status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.contribution_audit_logs (
        contribution_id, clinic_id, action, previous_status, new_status, 
        previous_value, new_value, performed_by
      ) VALUES (
        NEW.id, NEW.clinic_id, 'status_changed', OLD.status, NEW.status,
        OLD.value, NEW.value, auth.uid()
      );
    -- Registrar mudança de valor
    ELSIF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO public.contribution_audit_logs (
        contribution_id, clinic_id, action, previous_status, new_status, 
        previous_value, new_value, performed_by, notes
      ) VALUES (
        NEW.id, NEW.clinic_id, 'value_adjusted', OLD.status, NEW.status,
        OLD.value, NEW.value, auth.uid(), 'Ajuste de valor'
      );
    -- Registrar conciliação
    ELSIF OLD.is_reconciled IS DISTINCT FROM NEW.is_reconciled AND NEW.is_reconciled = true THEN
      INSERT INTO public.contribution_audit_logs (
        contribution_id, clinic_id, action, new_status, new_value, performed_by, notes
      ) VALUES (
        NEW.id, NEW.clinic_id, 'reconciled', NEW.status, NEW.value, 
        NEW.reconciled_by, NEW.reconciliation_notes
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Criar trigger de auditoria
DROP TRIGGER IF EXISTS trigger_log_contribution_change ON public.employer_contributions;
CREATE TRIGGER trigger_log_contribution_change
AFTER INSERT OR UPDATE ON public.employer_contributions
FOR EACH ROW
EXECUTE FUNCTION public.log_contribution_change();

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_contributions_origin ON public.employer_contributions(origin);
CREATE INDEX IF NOT EXISTS idx_contributions_reconciled ON public.employer_contributions(is_reconciled);
CREATE INDEX IF NOT EXISTS idx_contributions_union_entity ON public.employer_contributions(union_entity_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_contribution ON public.contribution_audit_logs(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_clinic ON public.contribution_audit_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_action ON public.contribution_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_contribution_audit_performed_at ON public.contribution_audit_logs(performed_at DESC);

-- 8. Atualizar contribuições existentes com origem Lytex
UPDATE public.employer_contributions 
SET origin = 'lytex'
WHERE lytex_invoice_id IS NOT NULL AND origin = 'manual';

-- 9. Comentários nas colunas para documentação
COMMENT ON COLUMN public.employer_contributions.origin IS 'Origem da contribuição: manual, lytex ou import';
COMMENT ON COLUMN public.employer_contributions.lytex_transaction_id IS 'ID único da transação na Lytex';
COMMENT ON COLUMN public.employer_contributions.lytex_fee_amount IS 'Taxa cobrada pela Lytex em centavos';
COMMENT ON COLUMN public.employer_contributions.lytex_fee_details IS 'Detalhamento das taxas aplicadas pela Lytex';
COMMENT ON COLUMN public.employer_contributions.net_value IS 'Valor líquido recebido após taxas (centavos)';
COMMENT ON COLUMN public.employer_contributions.is_reconciled IS 'Indica se a contribuição foi conciliada financeiramente';
COMMENT ON COLUMN public.employer_contributions.reconciled_at IS 'Data/hora da conciliação';
COMMENT ON COLUMN public.employer_contributions.reconciled_by IS 'Usuário que realizou a conciliação';
COMMENT ON COLUMN public.employer_contributions.has_divergence IS 'Indica se há divergência entre valor esperado e recebido';
COMMENT ON COLUMN public.employer_contributions.divergence_details IS 'Detalhes da divergência encontrada';
COMMENT ON COLUMN public.employer_contributions.financial_category_id IS 'Categoria financeira para classificação contábil';
COMMENT ON COLUMN public.employer_contributions.cash_register_id IS 'Conta bancária de destino';
COMMENT ON COLUMN public.employer_contributions.imported_at IS 'Data/hora da importação da Lytex';
COMMENT ON COLUMN public.employer_contributions.lytex_raw_data IS 'Dados brutos retornados pela API Lytex';
COMMENT ON COLUMN public.employer_contributions.is_editable IS 'Indica se campos críticos podem ser editados (false para Lytex)';
