-- Corrigir a função notify_waiting_list_on_cancellation para usar is_active ao invés de status
CREATE OR REPLACE FUNCTION public.notify_waiting_list_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  waiting_patient RECORD;
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
BEGIN
  -- Só processa quando status muda para 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Busca primeiro paciente na lista de espera para este profissional/data
    SELECT wl.*, p.name as patient_name, p.phone as patient_phone
    INTO waiting_patient
    FROM public.waiting_list wl
    JOIN public.patients p ON p.id = wl.patient_id
    WHERE wl.clinic_id = NEW.clinic_id
      AND wl.professional_id = NEW.professional_id
      AND wl.is_active = true
      AND wl.notification_sent = false
      AND (NEW.appointment_date = ANY(wl.preferred_dates) OR wl.preferred_dates IS NULL OR array_length(wl.preferred_dates, 1) = 0)
    ORDER BY wl.created_at ASC
    LIMIT 1;
    
    IF waiting_patient.id IS NOT NULL AND waiting_patient.patient_phone IS NOT NULL THEN
      -- Chama edge function para notificar
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/notify-waiting-list',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_anon_key
        ),
        body := jsonb_build_object(
          'waiting_list_id', waiting_patient.id,
          'clinic_id', NEW.clinic_id,
          'patient_id', waiting_patient.patient_id,
          'patient_name', waiting_patient.patient_name,
          'patient_phone', waiting_patient.patient_phone,
          'available_date', NEW.appointment_date,
          'available_time', NEW.start_time,
          'professional_id', NEW.professional_id
        )
      );
      
      -- Marca como notificado
      UPDATE public.waiting_list
      SET notification_sent = true,
          notification_sent_at = now(),
          slot_offered_at = now(),
          slot_expires_at = now() + interval '2 hours'
      WHERE id = waiting_patient.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;