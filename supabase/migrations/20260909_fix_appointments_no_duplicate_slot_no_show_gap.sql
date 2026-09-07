-- Corrige o índice de anti-duplicidade de agenda (appointments).
--
-- Problema real observado: em 09/09/2026 às 15:00-15:30, a profissional
-- Juliane Leite (Clínica Geral Odontológica) ficou com DOIS agendamentos no
-- mesmo horário: um com status 'no_show' e outro com status 'blocked'.
-- Isso foi possível porque o índice único parcial existente exclui
-- 'no_show' da checagem de duplicidade, então inserir um novo registro
-- (ex.: 'blocked') no mesmo slot de um agendamento já marcado como
-- 'no_show' não violava a constraint.
--
-- Esta migração recria o índice removendo 'no_show' da lista de status
-- ignorados, para que um slot com 'no_show' continue sendo tratado como
-- ocupado e não permita nova inserção sobreposta no mesmo horário.

DROP INDEX IF EXISTS public.idx_appointments_no_duplicate_slot;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_duplicate_slot
  ON public.appointments (professional_id, appointment_date, start_time)
  WHERE (status NOT IN ('cancelled', 'completed'));
