-- Adicionar coluna de configuração na tabela clinics
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS enforce_schedule_validation BOOLEAN DEFAULT true;

COMMENT ON COLUMN clinics.enforce_schedule_validation IS 
'Quando ativado, impede agendamentos fora dos horários configurados do profissional';

-- Criar função de validação de horários
CREATE OR REPLACE FUNCTION validate_appointment_schedule()
RETURNS TRIGGER AS $$
DECLARE
  clinic_enforce_validation BOOLEAN;
  professional_schedule JSONB;
  day_key TEXT;
  day_schedule JSONB;
  slot_start TIME;
  slot_end TIME;
  is_valid BOOLEAN := FALSE;
  slots_count INTEGER;
BEGIN
  -- Verificar se a clínica tem validação habilitada
  SELECT enforce_schedule_validation INTO clinic_enforce_validation
  FROM clinics
  WHERE id = NEW.clinic_id;
  
  -- Se a validação está desabilitada, permitir agendamento
  IF clinic_enforce_validation = FALSE OR clinic_enforce_validation IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar schedule do profissional
  SELECT schedule INTO professional_schedule
  FROM professionals
  WHERE id = NEW.professional_id;
  
  -- Se não tem schedule configurado, permitir
  IF professional_schedule IS NULL OR professional_schedule = '{}'::jsonb THEN
    RETURN NEW;
  END IF;
  
  -- Determinar o dia da semana (0=domingo, 1=segunda, etc)
  day_key := CASE EXTRACT(DOW FROM NEW.appointment_date)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;
  
  day_schedule := professional_schedule->day_key;
  
  -- Verificar se o dia está habilitado
  IF day_schedule IS NULL OR (day_schedule->>'enabled')::boolean IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'HORARIO_INVALIDO: O profissional não atende neste dia da semana.';
  END IF;
  
  -- Verificar se há slots configurados
  IF day_schedule->'slots' IS NULL THEN
    RETURN NEW;
  END IF;
  
  slots_count := jsonb_array_length(day_schedule->'slots');
  
  IF slots_count = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se o horário está dentro de algum slot
  FOR i IN 0..slots_count-1 LOOP
    slot_start := (day_schedule->'slots'->i->>'start')::TIME;
    slot_end := (day_schedule->'slots'->i->>'end')::TIME;
    
    IF NEW.start_time >= slot_start AND NEW.start_time < slot_end THEN
      is_valid := TRUE;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT is_valid THEN
    RAISE EXCEPTION 'HORARIO_INVALIDO: O horário selecionado está fora do expediente do profissional.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger (remover se existir primeiro)
DROP TRIGGER IF EXISTS trigger_validate_appointment_schedule ON appointments;
CREATE TRIGGER trigger_validate_appointment_schedule
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION validate_appointment_schedule();