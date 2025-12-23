-- Adicionar coluna max_messages_monthly na tabela subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_messages_monthly integer DEFAULT 100;

-- Criar tabela message_logs para rastrear envios de mensagens
CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  message_type text NOT NULL,
  phone text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  month_year text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Índice para queries eficientes por clínica e mês
CREATE INDEX IF NOT EXISTS idx_message_logs_clinic_month ON public.message_logs(clinic_id, month_year);

-- Habilitar RLS na tabela message_logs
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para message_logs
CREATE POLICY "Clinic admins can view their message logs"
ON public.message_logs
FOR SELECT
USING (is_clinic_admin(auth.uid(), clinic_id));

CREATE POLICY "System can insert message logs"
ON public.message_logs
FOR INSERT
WITH CHECK (true);

-- Função para obter uso de mensagens da clínica
CREATE OR REPLACE FUNCTION public.get_clinic_message_usage(
  _clinic_id uuid, 
  _month_year text DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS TABLE(
  used integer,
  max_allowed integer,
  remaining integer
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
  _max integer;
BEGIN
  -- Contar mensagens do mês
  SELECT COUNT(*)::integer INTO _count
  FROM message_logs
  WHERE clinic_id = _clinic_id AND month_year = _month_year;
  
  -- Buscar limite do plano (0 = ilimitado)
  SELECT COALESCE(sp.max_messages_monthly, 100) INTO _max
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.clinic_id = _clinic_id
  LIMIT 1;
  
  -- Se não encontrou assinatura, usar limite padrão
  IF _max IS NULL THEN
    _max := 100;
  END IF;
  
  -- Se max = 0, significa ilimitado, retornar remaining como 999999
  IF _max = 0 THEN
    RETURN QUERY SELECT _count, 0, 999999;
  ELSE
    RETURN QUERY SELECT _count, _max, GREATEST(0, _max - _count);
  END IF;
END;
$$;