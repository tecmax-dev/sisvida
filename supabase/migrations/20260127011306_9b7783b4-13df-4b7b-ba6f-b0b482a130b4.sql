-- Fonte única de verdade para janela de agendamento (por clínica)

-- 1) Calcula a data final permitida com base em clinics.booking_months_ahead.
--    Se booking_months_ahead for NULL, não há restrição (retorna NULL).
CREATE OR REPLACE FUNCTION public.get_booking_window_end_date(p_clinic_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN c.booking_months_ahead IS NULL THEN NULL
      WHEN c.booking_months_ahead < 1 THEN (date_trunc('month', current_date)::date + interval '1 month' - interval '1 day')::date
      ELSE (date_trunc('month', current_date) + make_interval(months => c.booking_months_ahead) - interval '1 day')::date
    END
  FROM public.clinics c
  WHERE c.id = p_clinic_id;
$$;

-- 2) Atualiza booking_months_ahead com validação e permissão (somente admin/owner/super admin)
CREATE OR REPLACE FUNCTION public.set_clinic_booking_months_ahead(p_clinic_id uuid, p_months_ahead integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- validação básica
  IF p_months_ahead IS NULL OR p_months_ahead < 1 OR p_months_ahead > 12 THEN
    RAISE EXCEPTION 'invalid_booking_months_ahead'
      USING MESSAGE = 'Parâmetro inválido para configuração de agendamento.';
  END IF;

  -- permissão: super admin OU owner/admin na clínica (sem access_group_id)
  IF NOT (
    EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.clinic_id = p_clinic_id
        AND ur.access_group_id IS NULL
        AND ur.role IN ('owner', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'not_allowed'
      USING MESSAGE = 'Agendamento indisponível para este período';
  END IF;

  UPDATE public.clinics
  SET booking_months_ahead = p_months_ahead
  WHERE id = p_clinic_id;
END;
$$;

-- 3) Enforce server-side: impede criar/mover agendamentos além da janela configurada.
CREATE OR REPLACE FUNCTION public.enforce_booking_window_on_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end_date date;
BEGIN
  -- Em UPDATE, se data/clinica não mudou, não revalidar (evita quebrar manutenção de agendas antigas)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.appointment_date = OLD.appointment_date AND NEW.clinic_id = OLD.clinic_id THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.clinic_id IS NULL OR NEW.appointment_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_end_date := public.get_booking_window_end_date(NEW.clinic_id);

  IF v_end_date IS NOT NULL AND (NEW.appointment_date::date > v_end_date) THEN
    RAISE EXCEPTION 'booking_window_exceeded'
      USING MESSAGE = 'Agendamento indisponível para este período';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_window_on_appointments ON public.appointments;
CREATE TRIGGER trg_enforce_booking_window_on_appointments
BEFORE INSERT OR UPDATE OF appointment_date, clinic_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_window_on_appointments();
