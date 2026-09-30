CREATE OR REPLACE FUNCTION public.enforce_patient_sensitive_fields_admin_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_clinic_admin(auth.uid(), OLD.clinic_id) OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF (OLD.max_appointments_per_month IS DISTINCT FROM NEW.max_appointments_per_month) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: Apenas administradores podem alterar o limite de consultas do paciente.';
  END IF;

  IF (OLD.no_show_blocked_until IS DISTINCT FROM NEW.no_show_blocked_until) OR
     (OLD.no_show_blocked_at IS DISTINCT FROM NEW.no_show_blocked_at) OR
     (OLD.no_show_blocked_professional_id IS DISTINCT FROM NEW.no_show_blocked_professional_id) OR
     (OLD.no_show_unblocked_at IS DISTINCT FROM NEW.no_show_unblocked_at) OR
     (OLD.no_show_unblocked_by IS DISTINCT FROM NEW.no_show_unblocked_by) THEN
    IF public.user_has_permission(auth.uid(), OLD.clinic_id, 'unblock_patients')
       OR public.user_has_permission(auth.uid(), OLD.clinic_id, 'union_unblock_patients') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'ACESSO_NEGADO: Você não tem permissão para desbloquear pacientes.';
  END IF;

  RETURN NEW;
END;
$function$;