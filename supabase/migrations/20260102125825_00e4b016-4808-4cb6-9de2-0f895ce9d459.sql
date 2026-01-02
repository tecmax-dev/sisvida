-- Fix trigger: handle case when procedure_id is NULL (procedure_record not assigned)
CREATE OR REPLACE FUNCTION public.trigger_post_attendance_automation()
RETURNS TRIGGER AS $$
DECLARE
  patient_record RECORD;
  professional_record RECORD;
  procedure_name TEXT := '';
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get patient info
    SELECT name, phone INTO patient_record
    FROM public.patients WHERE id = NEW.patient_id;
    
    -- Get professional info
    SELECT name INTO professional_record
    FROM public.professionals WHERE id = NEW.professional_id;
    
    -- Get procedure name if exists
    IF NEW.procedure_id IS NOT NULL THEN
      SELECT name INTO procedure_name
      FROM public.procedures WHERE id = NEW.procedure_id;
    END IF;
    
    -- Call edge function via http extension (async)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/execute-automation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'trigger_type', 'post_attendance',
        'clinic_id', NEW.clinic_id,
        'patient_id', NEW.patient_id,
        'patient_name', patient_record.name,
        'patient_phone', patient_record.phone,
        'extra_data', jsonb_build_object(
          'professional_name', professional_record.name,
          'procedure_name', COALESCE(procedure_name, ''),
          'appointment_date', to_char(NEW.appointment_date, 'DD/MM/YYYY'),
          'appointment_time', NEW.start_time::text
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;