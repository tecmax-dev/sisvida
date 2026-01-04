-- Tabela para log de sincronizações Lytex
CREATE TABLE public.lytex_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'clients', 'invoices', 'full'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  clients_imported INTEGER DEFAULT 0,
  clients_updated INTEGER DEFAULT 0,
  invoices_imported INTEGER DEFAULT 0,
  invoices_updated INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.lytex_sync_logs ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver logs da própria clínica
CREATE POLICY "Clinic users can view sync logs"
  ON public.lytex_sync_logs
  FOR SELECT
  USING (has_clinic_access(auth.uid(), clinic_id));

-- Política: service role pode inserir/atualizar
CREATE POLICY "Service role can manage sync logs"
  ON public.lytex_sync_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices
CREATE INDEX idx_lytex_sync_logs_clinic ON public.lytex_sync_logs(clinic_id);
CREATE INDEX idx_lytex_sync_logs_status ON public.lytex_sync_logs(status);

-- Adicionar coluna lytex_client_id na tabela employers se não existir
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS lytex_client_id TEXT;
CREATE INDEX IF NOT EXISTS idx_employers_lytex_client_id ON public.employers(lytex_client_id);