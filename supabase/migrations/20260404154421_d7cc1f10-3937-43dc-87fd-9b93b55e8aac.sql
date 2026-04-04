
-- 1) Trigger de CPF duplicado
CREATE TRIGGER trg_check_cpf_duplicate
  BEFORE INSERT OR UPDATE OF cpf ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION check_cpf_duplicate();

-- 2) Corrigir escalonamento de privilégios
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;
CREATE POLICY "Only service role can insert roles"
  ON public.user_roles FOR INSERT TO service_role WITH CHECK (true);

-- 3) View segura de disponibilidade
DROP VIEW IF EXISTS public.homologacao_availability;
CREATE VIEW public.homologacao_availability AS
SELECT id, clinic_id, professional_id, appointment_date, start_time, end_time, status
FROM public.homologacao_appointments WHERE status <> 'cancelled';
ALTER VIEW public.homologacao_availability SET (security_invoker = on);

DROP POLICY IF EXISTS "Public can view appointments for availability" ON public.homologacao_appointments;
CREATE POLICY "Public can view limited appointment data"
  ON public.homologacao_appointments FOR SELECT TO anon USING (false);

-- 4) Whazing: restringir a service_role apenas (frontend usa edge functions)
DROP POLICY IF EXISTS "Authenticated users can read whazing messages" ON public.whazing_messages;
CREATE POLICY "Service role can read whazing messages"
  ON public.whazing_messages FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Authenticated users can read whazing tickets" ON public.whazing_tickets;
CREATE POLICY "Service role can read whazing tickets"
  ON public.whazing_tickets FOR SELECT TO service_role USING (true);

-- Manter policies de INSERT/UPDATE para service_role
DROP POLICY IF EXISTS "Authenticated users can insert whazing messages" ON public.whazing_messages;
CREATE POLICY "Service role can insert whazing messages"
  ON public.whazing_messages FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update whazing messages" ON public.whazing_messages;
CREATE POLICY "Service role can update whazing messages"
  ON public.whazing_messages FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert whazing tickets" ON public.whazing_tickets;
CREATE POLICY "Service role can insert whazing tickets"
  ON public.whazing_tickets FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update whazing tickets" ON public.whazing_tickets;
CREATE POLICY "Service role can update whazing tickets"
  ON public.whazing_tickets FOR UPDATE TO service_role USING (true);

-- 5) Função segura para buscar tickets do whazing por clínica
CREATE OR REPLACE FUNCTION get_whazing_tickets_for_clinic(p_clinic_id UUID)
RETURNS SETOF whazing_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  RETURN QUERY SELECT * FROM whazing_tickets ORDER BY updated_at DESC;
END;
$$;

-- 6) Função segura para buscar mensagens do whazing
CREATE OR REPLACE FUNCTION get_whazing_messages_for_ticket(p_ticket_id TEXT, p_clinic_id UUID)
RETURNS SETOF whazing_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  RETURN QUERY SELECT * FROM whazing_messages WHERE ticket_id = p_ticket_id ORDER BY timestamp ASC;
END;
$$;

-- 7) Buckets privados
UPDATE storage.buckets SET public = false WHERE id IN ('patient-photos', 'sindical-documentos', 'dependent-documents');
