-- Atualizar função de bloqueio para 30 dias ao invés do fim do mês seguinte
CREATE OR REPLACE FUNCTION public.handle_no_show_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  block_end_date DATE;
BEGIN
  -- Only process when status changes TO 'no_show'
  IF NEW.status = 'no_show' AND (OLD.status IS NULL OR OLD.status != 'no_show') THEN
    -- Bloquear por 30 dias a partir de hoje
    block_end_date := CURRENT_DATE + INTERVAL '30 days';
    
    -- Update patient with block info
    UPDATE patients
    SET 
      no_show_blocked_until = block_end_date,
      no_show_blocked_at = NOW(),
      no_show_unblocked_by = NULL,
      no_show_unblocked_at = NULL
    WHERE id = NEW.patient_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para enviar notificação WhatsApp quando marcar no_show
CREATE OR REPLACE FUNCTION public.trigger_no_show_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  patient_record RECORD;
  clinic_record RECORD;
  block_end_date DATE;
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
BEGIN
  -- Only process when status changes TO 'no_show'
  IF NEW.status = 'no_show' AND (OLD.status IS NULL OR OLD.status != 'no_show') THEN
    -- Get patient info
    SELECT name, phone INTO patient_record
    FROM public.patients WHERE id = NEW.patient_id;
    
    -- Get clinic info
    SELECT name INTO clinic_record
    FROM public.clinics WHERE id = NEW.clinic_id;
    
    -- Calculate block end date (30 days)
    block_end_date := CURRENT_DATE + INTERVAL '30 days';
    
    -- Call edge function to send WhatsApp notification
    IF patient_record.phone IS NOT NULL AND patient_record.phone != '' THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-no-show-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_anon_key
        ),
        body := jsonb_build_object(
          'clinic_id', NEW.clinic_id,
          'patient_id', NEW.patient_id,
          'patient_name', patient_record.name,
          'patient_phone', patient_record.phone,
          'clinic_name', clinic_record.name,
          'appointment_date', to_char(NEW.appointment_date, 'DD/MM/YYYY'),
          'block_until', to_char(block_end_date, 'DD/MM/YYYY')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_no_show_notification ON appointments;
CREATE TRIGGER trigger_no_show_notification
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_no_show_notification();