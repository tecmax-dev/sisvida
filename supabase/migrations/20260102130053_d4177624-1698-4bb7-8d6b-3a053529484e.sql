-- Fix trigger: use hardcoded Supabase URL instead of current_setting
CREATE OR REPLACE FUNCTION public.trigger_post_attendance_automation()
RETURNS TRIGGER AS $$
DECLARE
  patient_record RECORD;
  professional_record RECORD;
  procedure_name TEXT := '';
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
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
      url := supabase_url || '/functions/v1/execute-automation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
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

-- Also fix trigger_post_registration_automation
CREATE OR REPLACE FUNCTION public.trigger_post_registration_automation()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
BEGIN
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/execute-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_anon_key
    ),
    body := jsonb_build_object(
      'trigger_type', 'post_registration',
      'clinic_id', NEW.clinic_id,
      'patient_id', NEW.id,
      'patient_name', NEW.name,
      'patient_phone', NEW.phone
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also fix trigger_appointment_confirmed_automation
CREATE OR REPLACE FUNCTION public.trigger_appointment_confirmed_automation()
RETURNS TRIGGER AS $$
DECLARE
  patient_record RECORD;
  professional_record RECORD;
  supabase_url TEXT := 'https://eahhszmbyxapxzilfdlo.supabase.co';
  supabase_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaGhzem1ieXhhcHh6aWxmZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTU5MjYsImV4cCI6MjA4MTUzMTkyNn0.htkBUD0WjXQT8C1Wr4vTuTI_uanKPxe0NEk7QwHAPkU';
BEGIN
  IF NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL THEN
    SELECT name, phone INTO patient_record
    FROM public.patients WHERE id = NEW.patient_id;
    
    SELECT name INTO professional_record
    FROM public.professionals WHERE id = NEW.professional_id;
    
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/execute-automation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_anon_key
      ),
      body := jsonb_build_object(
        'trigger_type', 'appointment_confirmed',
        'clinic_id', NEW.clinic_id,
        'patient_id', NEW.patient_id,
        'patient_name', patient_record.name,
        'patient_phone', patient_record.phone,
        'extra_data', jsonb_build_object(
          'professional_name', professional_record.name,
          'appointment_date', to_char(NEW.appointment_date, 'DD/MM/YYYY'),
          'appointment_time', NEW.start_time::text
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;