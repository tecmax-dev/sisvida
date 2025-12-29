-- Tabela para feriados nacionais (gerenciados pelo sistema)
CREATE TABLE public.national_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  year INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_month INTEGER,
  recurring_day INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(holiday_date)
);

-- Tabela para feriados estaduais
CREATE TABLE public.state_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  year INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_month INTEGER,
  recurring_day INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(state_code, holiday_date)
);

-- Tabela para feriados municipais (cidade)
CREATE TABLE public.municipal_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state_code TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  year INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_month INTEGER,
  recurring_day INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city, state_code, holiday_date)
);

-- Tabela para feriados customizados da clínica
CREATE TABLE public.clinic_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_month INTEGER,
  recurring_day INTEGER,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, holiday_date)
);

-- Configuração de feriados por clínica
ALTER TABLE public.clinics 
ADD COLUMN IF NOT EXISTS holidays_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS state_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Enable RLS
ALTER TABLE public.national_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policies para national_holidays (todos podem ler, apenas super admin pode gerenciar)
CREATE POLICY "Anyone can view national holidays" ON public.national_holidays
FOR SELECT USING (true);

CREATE POLICY "Super admins can manage national holidays" ON public.national_holidays
FOR ALL USING (is_super_admin(auth.uid()));

-- RLS Policies para state_holidays
CREATE POLICY "Anyone can view state holidays" ON public.state_holidays
FOR SELECT USING (true);

CREATE POLICY "Super admins can manage state holidays" ON public.state_holidays
FOR ALL USING (is_super_admin(auth.uid()));

-- RLS Policies para municipal_holidays
CREATE POLICY "Anyone can view municipal holidays" ON public.municipal_holidays
FOR SELECT USING (true);

CREATE POLICY "Super admins can manage municipal holidays" ON public.municipal_holidays
FOR ALL USING (is_super_admin(auth.uid()));

-- RLS Policies para clinic_holidays
CREATE POLICY "Clinic members can view their holidays" ON public.clinic_holidays
FOR SELECT USING (has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Clinic admins can manage their holidays" ON public.clinic_holidays
FOR ALL USING (is_clinic_admin(auth.uid(), clinic_id));

-- Função para verificar se uma data é feriado para uma clínica
CREATE OR REPLACE FUNCTION public.is_holiday(p_clinic_id UUID, p_date DATE)
RETURNS TABLE(is_holiday BOOLEAN, holiday_name TEXT, holiday_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clinic RECORD;
  v_holiday_name TEXT;
  v_holiday_type TEXT;
  v_holidays_enabled BOOLEAN;
BEGIN
  -- Buscar configuração da clínica
  SELECT holidays_enabled, state_code, city INTO v_clinic
  FROM clinics
  WHERE id = p_clinic_id;
  
  -- Se feriados estão desabilitados, retornar false
  IF v_clinic.holidays_enabled = false OR v_clinic.holidays_enabled IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Verificar feriado nacional
  SELECT name INTO v_holiday_name
  FROM national_holidays
  WHERE holiday_date = p_date
     OR (is_recurring = true AND recurring_month = EXTRACT(MONTH FROM p_date) AND recurring_day = EXTRACT(DAY FROM p_date))
  LIMIT 1;
  
  IF v_holiday_name IS NOT NULL THEN
    RETURN QUERY SELECT true, v_holiday_name, 'nacional'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar feriado estadual (se clínica tem estado configurado)
  IF v_clinic.state_code IS NOT NULL THEN
    SELECT name INTO v_holiday_name
    FROM state_holidays
    WHERE state_code = v_clinic.state_code
      AND (holiday_date = p_date OR (is_recurring = true AND recurring_month = EXTRACT(MONTH FROM p_date) AND recurring_day = EXTRACT(DAY FROM p_date)))
    LIMIT 1;
    
    IF v_holiday_name IS NOT NULL THEN
      RETURN QUERY SELECT true, v_holiday_name, 'estadual'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Verificar feriado municipal (se clínica tem cidade configurada)
  IF v_clinic.city IS NOT NULL AND v_clinic.state_code IS NOT NULL THEN
    SELECT name INTO v_holiday_name
    FROM municipal_holidays
    WHERE city = v_clinic.city
      AND state_code = v_clinic.state_code
      AND (holiday_date = p_date OR (is_recurring = true AND recurring_month = EXTRACT(MONTH FROM p_date) AND recurring_day = EXTRACT(DAY FROM p_date)))
    LIMIT 1;
    
    IF v_holiday_name IS NOT NULL THEN
      RETURN QUERY SELECT true, v_holiday_name, 'municipal'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Verificar feriado customizado da clínica
  SELECT name INTO v_holiday_name
  FROM clinic_holidays
  WHERE clinic_id = p_clinic_id
    AND (holiday_date = p_date OR (is_recurring = true AND recurring_month = EXTRACT(MONTH FROM p_date) AND recurring_day = EXTRACT(DAY FROM p_date)))
  LIMIT 1;
  
  IF v_holiday_name IS NOT NULL THEN
    RETURN QUERY SELECT true, v_holiday_name, 'clinica'::TEXT;
    RETURN;
  END IF;
  
  -- Não é feriado
  RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT;
END;
$$;

-- Trigger para validar agendamentos em feriados
CREATE OR REPLACE FUNCTION public.validate_appointment_holiday()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Verificar se a data é feriado
  SELECT * INTO v_result FROM is_holiday(NEW.clinic_id, NEW.appointment_date);
  
  IF v_result.is_holiday = true THEN
    RAISE EXCEPTION 'FERIADO: Não é possível agendar nesta data. % (feriado %).', v_result.holiday_name, v_result.holiday_type;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para validar feriados antes de criar/atualizar agendamento
CREATE TRIGGER validate_holiday_before_appointment
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_appointment_holiday();

-- Inserir feriados nacionais do Brasil (recorrentes)
INSERT INTO public.national_holidays (name, holiday_date, year, is_recurring, recurring_month, recurring_day) VALUES
('Confraternização Universal', '2025-01-01', 2025, true, 1, 1),
('Tiradentes', '2025-04-21', 2025, true, 4, 21),
('Dia do Trabalho', '2025-05-01', 2025, true, 5, 1),
('Independência do Brasil', '2025-09-07', 2025, true, 9, 7),
('Nossa Senhora Aparecida', '2025-10-12', 2025, true, 10, 12),
('Finados', '2025-11-02', 2025, true, 11, 2),
('Proclamação da República', '2025-11-15', 2025, true, 11, 15),
('Natal', '2025-12-25', 2025, true, 12, 25)
ON CONFLICT (holiday_date) DO NOTHING;

-- Feriados móveis 2025 (Carnaval, Sexta-feira Santa, Corpus Christi)
INSERT INTO public.national_holidays (name, holiday_date, year, is_recurring, recurring_month, recurring_day) VALUES
('Carnaval', '2025-03-03', 2025, false, NULL, NULL),
('Carnaval', '2025-03-04', 2025, false, NULL, NULL),
('Sexta-feira Santa', '2025-04-18', 2025, false, NULL, NULL),
('Corpus Christi', '2025-06-19', 2025, false, NULL, NULL)
ON CONFLICT (holiday_date) DO NOTHING;

-- Feriados móveis 2026
INSERT INTO public.national_holidays (name, holiday_date, year, is_recurring, recurring_month, recurring_day) VALUES
('Carnaval', '2026-02-16', 2026, false, NULL, NULL),
('Carnaval', '2026-02-17', 2026, false, NULL, NULL),
('Sexta-feira Santa', '2026-04-03', 2026, false, NULL, NULL),
('Corpus Christi', '2026-06-04', 2026, false, NULL, NULL)
ON CONFLICT (holiday_date) DO NOTHING;