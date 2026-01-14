-- Adicionar colunas para melhor rastreabilidade de conciliação Lytex

-- Coluna para controle de idempotência de sincronização
ALTER TABLE public.employer_contributions 
ADD COLUMN IF NOT EXISTS last_lytex_sync_at TIMESTAMPTZ DEFAULT NULL;

-- Coluna para armazenar status original da Lytex (para auditoria)
ALTER TABLE public.employer_contributions 
ADD COLUMN IF NOT EXISTS lytex_original_status TEXT DEFAULT NULL;

-- Expandir tabela de logs para suportar detalhamento de conciliação
ALTER TABLE public.lytex_sync_logs 
ADD COLUMN IF NOT EXISTS sync_mode TEXT DEFAULT 'manual';

ALTER TABLE public.lytex_sync_logs 
ADD COLUMN IF NOT EXISTS invoices_conciliated INTEGER DEFAULT 0;

ALTER TABLE public.lytex_sync_logs 
ADD COLUMN IF NOT EXISTS invoices_already_conciliated INTEGER DEFAULT 0;

ALTER TABLE public.lytex_sync_logs 
ADD COLUMN IF NOT EXISTS invoices_ignored INTEGER DEFAULT 0;

-- Criar tabela dedicada para log detalhado de conciliação
CREATE TABLE IF NOT EXISTS public.lytex_conciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sync_log_id UUID REFERENCES public.lytex_sync_logs(id) ON DELETE SET NULL,
  contribution_id UUID REFERENCES public.employer_contributions(id) ON DELETE SET NULL,
  lytex_invoice_id TEXT NOT NULL,
  lytex_transaction_id TEXT,
  
  -- Status antes e depois
  previous_status TEXT,
  new_status TEXT,
  
  -- Dados de pagamento da Lytex
  lytex_paid_at TIMESTAMPTZ,
  lytex_paid_value INTEGER,
  lytex_payment_method TEXT,
  lytex_fee_amount INTEGER,
  lytex_net_value INTEGER,
  
  -- Resultado da conciliação
  conciliation_result TEXT NOT NULL CHECK (conciliation_result IN (
    'conciliated',           -- Baixa automática realizada
    'already_conciliated',   -- Já estava pago no sistema
    'ignored',               -- Ignorado (ex: cancelado, sem match)
    'error'                  -- Erro durante processamento
  )),
  conciliation_reason TEXT,  -- Motivo detalhado
  
  -- Metadados
  raw_lytex_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lytex_conciliation_logs_clinic_id ON public.lytex_conciliation_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lytex_conciliation_logs_sync_log_id ON public.lytex_conciliation_logs(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_lytex_conciliation_logs_contribution_id ON public.lytex_conciliation_logs(contribution_id);
CREATE INDEX IF NOT EXISTS idx_lytex_conciliation_logs_lytex_invoice_id ON public.lytex_conciliation_logs(lytex_invoice_id);
CREATE INDEX IF NOT EXISTS idx_lytex_conciliation_logs_created_at ON public.lytex_conciliation_logs(created_at DESC);

-- Índice para busca por transaction_id (idempotência)
CREATE INDEX IF NOT EXISTS idx_employer_contributions_lytex_transaction_id 
ON public.employer_contributions(lytex_transaction_id) WHERE lytex_transaction_id IS NOT NULL;

-- RLS para a nova tabela
ALTER TABLE public.lytex_conciliation_logs ENABLE ROW LEVEL SECURITY;

-- Usar função is_super_admin e has_clinic_access existentes
CREATE POLICY "Users can view conciliation logs"
ON public.lytex_conciliation_logs
FOR SELECT
USING (
  public.has_clinic_access(auth.uid(), clinic_id)
  OR public.is_super_admin(auth.uid())
);

-- Permitir insert via service role (edge functions)
CREATE POLICY "Service role can insert conciliation logs"
ON public.lytex_conciliation_logs
FOR INSERT
WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.lytex_conciliation_logs IS 'Log detalhado de cada conciliação Lytex - boleto pago baixado no sistema';
COMMENT ON COLUMN public.lytex_conciliation_logs.conciliation_result IS 'Resultado: conciliated=baixa ok, already_conciliated=já pago, ignored=sem match, error=falha';
COMMENT ON COLUMN public.employer_contributions.last_lytex_sync_at IS 'Última vez que esta contribuição foi verificada na API Lytex';