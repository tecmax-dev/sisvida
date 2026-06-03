-- Garante que slots com status 'blocked' bloqueiem novos agendamentos
-- (antes eram ignorados pelo índice único e pelo trigger de conflito,
--  permitindo que o fluxo de agendamento via WhatsApp criasse consultas
--  sobre slots bloqueados pelo profissional/admin).

-- 1) Recria o índice único incluindo 'blocked' no conjunto bloqueante
DROP INDEX IF EXISTS public.idx_appointments_no_duplicate_slot;

CREATE UNIQUE INDEX idx_appointments_no_duplicate_slot
ON public.appointments (professional_id, appointment_date, start_time)
WHERE (status <> ALL (ARRAY[
  'cancelled'::appointment_status,
  'completed'::appointment_status,
  'no_show'::appointment_status
]));

-- 2) Atualiza o trigger de validação de conflito para considerar 'blocked'
--    como horário ocupado tanto para o novo registro quanto para os existentes.
CREATE OR REPLACE FUNCTION public.validate_appointment_no_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Pular apenas registros finalizados/cancelados
  IF NEW.status IN ('cancelled', 'completed', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- Verifica sobreposição contra qualquer agendamento ativo OU bloqueado
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.professional_id = NEW.professional_id
      AND a.appointment_date = NEW.appointment_date
      AND a.id IS DISTINCT FROM NEW.id
      AND a.status NOT IN ('cancelled', 'completed', 'no_show')
      AND a.start_time < NEW.end_time
      AND NEW.start_time < a.end_time
  ) THEN
    RAISE EXCEPTION 'CONFLITO: Já existe um agendamento ou bloqueio para este profissional neste horário (% - %). Escolha outro horário.',
      NEW.start_time, NEW.end_time;
  END IF;

  RETURN NEW;
END;
$function$;