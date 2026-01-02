-- Table for scheduled automations (with delay)
CREATE TABLE IF NOT EXISTS public.scheduled_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message_data JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_scheduled_automations_pending ON public.scheduled_automations(status, scheduled_at) 
WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.scheduled_automations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Clinic users can view their scheduled automations"
ON public.scheduled_automations FOR SELECT
USING (public.has_clinic_access(auth.uid(), clinic_id));

-- Function to trigger automation on appointment completion
CREATE OR REPLACE FUNCTION public.trigger_post_attendance_automation()
RETURNS TRIGGER AS $$
DECLARE
  patient_record RECORD;
  professional_record RECORD;
  procedure_record RECORD;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get patient info
    SELECT name, phone INTO patient_record
    FROM public.patients WHERE id = NEW.patient_id;
    
    -- Get professional info
    SELECT name INTO professional_record
    FROM public.professionals WHERE id = NEW.professional_id;
    
    -- Get procedure info if exists
    IF NEW.procedure_id IS NOT NULL THEN
      SELECT name INTO procedure_record
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
          'procedure_name', COALESCE(procedure_record.name, ''),
          'appointment_date', to_char(NEW.appointment_date, 'DD/MM/YYYY'),
          'appointment_time', NEW.start_time::text
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for post-attendance
DROP TRIGGER IF EXISTS on_appointment_completed ON public.appointments;
CREATE TRIGGER on_appointment_completed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_post_attendance_automation();

-- Function to trigger automation on new patient registration
CREATE OR REPLACE FUNCTION public.trigger_post_registration_automation()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function via http extension (async)
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/execute-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
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

-- Create trigger for post-registration
DROP TRIGGER IF EXISTS on_patient_created ON public.patients;
CREATE TRIGGER on_patient_created
  AFTER INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_post_registration_automation();

-- Function to trigger automation on appointment confirmation
CREATE OR REPLACE FUNCTION public.trigger_appointment_confirmed_automation()
RETURNS TRIGGER AS $$
DECLARE
  patient_record RECORD;
  professional_record RECORD;
BEGIN
  -- Only trigger when confirmed_at is set
  IF NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL THEN
    -- Get patient info
    SELECT name, phone INTO patient_record
    FROM public.patients WHERE id = NEW.patient_id;
    
    -- Get professional info
    SELECT name INTO professional_record
    FROM public.professionals WHERE id = NEW.professional_id;
    
    -- Call edge function via http extension (async)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/execute-automation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
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

-- Create trigger for appointment confirmation
DROP TRIGGER IF EXISTS on_appointment_confirmed ON public.appointments;
CREATE TRIGGER on_appointment_confirmed
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_confirmed_automation();