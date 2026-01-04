-- Criar tabela de tipos de contribuição
CREATE TABLE public.contribution_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_value INTEGER NOT NULL DEFAULT 0, -- Valor em centavos
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de contribuições/boletos
CREATE TABLE public.employer_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  contribution_type_id UUID NOT NULL REFERENCES public.contribution_types(id) ON DELETE RESTRICT,
  competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  competence_year INTEGER NOT NULL CHECK (competence_year >= 2020),
  value INTEGER NOT NULL CHECK (value > 0), -- Valor em centavos
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'overdue', 'cancelled')),
  -- Dados Lytex
  lytex_invoice_id TEXT,
  lytex_invoice_url TEXT,
  lytex_boleto_barcode TEXT,
  lytex_boleto_digitable_line TEXT,
  lytex_pix_code TEXT,
  lytex_pix_qrcode TEXT,
  -- Dados de pagamento
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_value INTEGER,
  payment_method TEXT,
  -- Metadados
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint para evitar duplicatas
  CONSTRAINT unique_contribution_per_employer UNIQUE (employer_id, contribution_type_id, competence_month, competence_year)
);

-- Tabela de logs de webhooks Lytex
CREATE TABLE public.lytex_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID,
  contribution_id UUID REFERENCES public.employer_contributions(id) ON DELETE SET NULL,
  webhook_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contribution_types_clinic ON public.contribution_types(clinic_id);
CREATE INDEX idx_employer_contributions_clinic ON public.employer_contributions(clinic_id);
CREATE INDEX idx_employer_contributions_employer ON public.employer_contributions(employer_id);
CREATE INDEX idx_employer_contributions_status ON public.employer_contributions(status);
CREATE INDEX idx_employer_contributions_competence ON public.employer_contributions(competence_year, competence_month);
CREATE INDEX idx_employer_contributions_lytex_id ON public.employer_contributions(lytex_invoice_id);
CREATE INDEX idx_lytex_webhook_logs_contribution ON public.lytex_webhook_logs(contribution_id);

-- Habilitar RLS
ALTER TABLE public.contribution_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lytex_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contribution_types
CREATE POLICY "Users can view contribution types from their clinic"
ON public.contribution_types FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage contribution types"
ON public.contribution_types FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id))
WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

-- Políticas RLS para employer_contributions
CREATE POLICY "Users can view contributions from their clinic"
ON public.employer_contributions FOR SELECT
USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Admins can manage contributions"
ON public.employer_contributions FOR ALL
USING (is_clinic_admin(auth.uid(), clinic_id))
WITH CHECK (is_clinic_admin(auth.uid(), clinic_id));

-- Políticas RLS para lytex_webhook_logs
CREATE POLICY "Admins can view webhook logs"
ON public.lytex_webhook_logs FOR SELECT
USING (clinic_id IS NULL OR is_clinic_admin(auth.uid(), clinic_id));

-- Triggers para updated_at
CREATE TRIGGER update_contribution_types_updated_at
BEFORE UPDATE ON public.contribution_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employer_contributions_updated_at
BEFORE UPDATE ON public.employer_contributions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar status de boletos vencidos
CREATE OR REPLACE FUNCTION public.update_overdue_contributions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.employer_contributions
  SET status = 'overdue'
  WHERE status = 'pending'
  AND due_date < CURRENT_DATE;
END;
$$;

-- Habilitar realtime para acompanhar atualizações
ALTER PUBLICATION supabase_realtime ADD TABLE public.employer_contributions;