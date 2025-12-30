-- Adicionar campo para dia de vencimento mensal na subscription
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS billing_day integer DEFAULT 5 CHECK (billing_day >= 1 AND billing_day <= 28);

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.subscriptions.billing_day IS 'Dia do mês em que a cobrança deve ser gerada (1-28)';