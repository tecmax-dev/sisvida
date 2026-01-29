
-- Problema: As políticas RLS usam auth.jwt() ->> 'patient_id', mas o login mobile
-- não armazena patient_id no JWT. Precisamos de uma abordagem que funcione com ambos.

-- Opção 1: Criar função para buscar notificações (bypass RLS com SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_patient_notifications(p_patient_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  type text,
  data jsonb,
  is_read boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pn.id,
    pn.title,
    pn.body,
    pn.type,
    pn.data,
    pn.is_read,
    pn.created_at
  FROM public.patient_notifications pn
  WHERE pn.patient_id = p_patient_id
  ORDER BY pn.created_at DESC
  LIMIT 50;
$$;

-- Função para marcar notificação como lida
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid, p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_notifications
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id 
    AND patient_id = p_patient_id;
  
  RETURN FOUND;
END;
$$;

-- Função para marcar todas notificações como lidas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_patient_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.patient_notifications
  SET is_read = true, read_at = now()
  WHERE patient_id = p_patient_id
    AND is_read = false;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

-- Habilitar realtime para a tabela (se ainda não está)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'patient_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_notifications;
  END IF;
END $$;
