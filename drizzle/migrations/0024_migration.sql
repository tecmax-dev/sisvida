CREATE OR REPLACE FUNCTION public.wl_join_queue(p_clinic_id uuid, p_patient_id uuid, p_professional_id uuid, p_specialty_id uuid DEFAULT NULL::uuid, p_source text DEFAULT 'app'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean; v_period text; v_limit int; v_count int;
  v_existing public.waiting_list%ROWTYPE; v_id uuid; v_position integer;
  v_start date; v_end date;
BEGIN
  SELECT waiting_list_enabled, COALESCE(titular_booking_period,'monthly'),
         CASE WHEN max_appointments_per_cpf_month = 0 THEN 0 ELSE GREATEST(1, COALESCE(max_appointments_per_cpf_month,1)) END
    INTO v_enabled, v_period, v_limit FROM public.clinics WHERE id = p_clinic_id;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'disabled');
  END IF;

  -- Regra: segue período e quantidade configurados para o titular.
  IF p_professional_id IS NOT NULL AND v_limit > 0 THEN
    SELECT b.p_start, b.p_end INTO v_start, v_end FROM public.booking_period_bounds(v_period, CURRENT_DATE) b;
    SELECT count(*) INTO v_count FROM public.appointments a
     WHERE a.clinic_id = p_clinic_id AND a.patient_id = p_patient_id
       AND a.professional_id = p_professional_id
       AND a.appointment_date BETWEEN v_start AND v_end
       AND a.status NOT IN ('cancelled','no_show','blocked');
    IF v_count >= v_limit THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_scheduled_this_month',
        'message', 'Associado já atingiu o limite de consultas com este profissional no período definido pelo sindicato.');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.waiting_list
   WHERE clinic_id = p_clinic_id AND patient_id = p_patient_id
     AND professional_id IS NOT DISTINCT FROM p_professional_id
     AND queue_status IN ('ATIVO','OFERTADO')
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_in_queue',
      'waiting_list_id', v_existing.id, 'position', v_existing.queue_position);
  END IF;

  INSERT INTO public.waiting_list (clinic_id, patient_id, professional_id, specialty_id, source, notes, is_active, queue_status, notification_status)
  VALUES (p_clinic_id, p_patient_id, p_professional_id, p_specialty_id, COALESCE(p_source,'app'), p_notes, true, 'ATIVO', 'pending')
  RETURNING id, queue_position INTO v_id, v_position;

  PERFORM public.wl_log(p_clinic_id, 'queue_joined', v_id, NULL, p_patient_id, p_professional_id,
    CASE WHEN p_source = 'app' THEN 'patient' ELSE 'staff' END, auth.uid(),
    jsonb_build_object('position', v_position, 'source', p_source));

  RETURN jsonb_build_object('success', true, 'waiting_list_id', v_id, 'position', v_position);
END;
$function$;