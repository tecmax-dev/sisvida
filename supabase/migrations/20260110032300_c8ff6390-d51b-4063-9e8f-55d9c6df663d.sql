-- =====================================================
-- MÓDULO HOMOLOGAÇÃO - Exames/Consultas Ocupacionais
-- =====================================================

-- 1. Configurações do módulo por clínica
CREATE TABLE IF NOT EXISTS public.homologacao_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  display_name text,
  logo_url text,
  institutional_text text,
  manager_whatsapp text,
  public_whatsapp text,
  require_confirmation boolean DEFAULT true,
  allow_cancellation boolean DEFAULT true,
  cancellation_deadline_hours integer DEFAULT 24,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id)
);

-- 2. Profissionais/Médicos do módulo
CREATE TABLE IF NOT EXISTS public.homologacao_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  function text,
  phone text,
  email text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Tipos de Serviço/Exame
CREATE TABLE IF NOT EXISTS public.homologacao_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  description text,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Horários dos Profissionais
CREATE TABLE IF NOT EXISTS public.homologacao_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.homologacao_professionals(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 5. Serviços por Profissional (muitos-para-muitos)
CREATE TABLE IF NOT EXISTS public.homologacao_professional_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.homologacao_professionals(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES public.homologacao_service_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(professional_id, service_type_id)
);

-- 6. Bloqueios de Agenda (feriados, indisponibilidades)
CREATE TABLE IF NOT EXISTS public.homologacao_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.homologacao_professionals(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  block_type text NOT NULL DEFAULT 'block' CHECK (block_type IN ('block', 'holiday')),
  reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- 7. Agendamentos
CREATE TABLE IF NOT EXISTS public.homologacao_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.homologacao_professionals(id),
  service_type_id uuid REFERENCES public.homologacao_service_types(id),
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  company_name text NOT NULL,
  company_cnpj text,
  company_phone text NOT NULL,
  company_email text,
  company_contact_name text,
  employee_name text NOT NULL,
  employee_cpf text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  confirmation_token uuid DEFAULT gen_random_uuid(),
  notification_sent_at timestamptz,
  notification_status text,
  reminder_sent_at timestamptz,
  protocol_number text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. Notificações enviadas
CREATE TABLE IF NOT EXISTS public.homologacao_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.homologacao_appointments(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('company', 'employee')),
  recipient_phone text NOT NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- ÍNDICES DE PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_homologacao_settings_clinic 
  ON public.homologacao_settings(clinic_id);

CREATE INDEX IF NOT EXISTS idx_homologacao_professionals_clinic 
  ON public.homologacao_professionals(clinic_id, is_active);

CREATE INDEX IF NOT EXISTS idx_homologacao_service_types_clinic 
  ON public.homologacao_service_types(clinic_id, is_active);

CREATE INDEX IF NOT EXISTS idx_homologacao_schedules_professional 
  ON public.homologacao_schedules(professional_id, is_active);

CREATE INDEX IF NOT EXISTS idx_homologacao_professional_services_prof 
  ON public.homologacao_professional_services(professional_id);

CREATE INDEX IF NOT EXISTS idx_homologacao_professional_services_service 
  ON public.homologacao_professional_services(service_type_id);

CREATE INDEX IF NOT EXISTS idx_homologacao_blocks_clinic_date 
  ON public.homologacao_blocks(clinic_id, block_date);

CREATE INDEX IF NOT EXISTS idx_homologacao_blocks_professional 
  ON public.homologacao_blocks(professional_id, block_date);

CREATE INDEX IF NOT EXISTS idx_homologacao_appointments_clinic_date 
  ON public.homologacao_appointments(clinic_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_homologacao_appointments_professional 
  ON public.homologacao_appointments(professional_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_homologacao_appointments_status 
  ON public.homologacao_appointments(clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_homologacao_notifications_appointment 
  ON public.homologacao_notifications(appointment_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.homologacao_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homologacao_notifications ENABLE ROW LEVEL SECURITY;

-- Settings: Super Admins e Clinic Admins podem gerenciar, público pode ler
CREATE POLICY "Super admins can manage all homologacao_settings"
  ON public.homologacao_settings FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_settings"
  ON public.homologacao_settings FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Public can read homologacao_settings"
  ON public.homologacao_settings FOR SELECT
  USING (true);

-- Professionals: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_professionals"
  ON public.homologacao_professionals FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_professionals"
  ON public.homologacao_professionals FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Public can read active homologacao_professionals"
  ON public.homologacao_professionals FOR SELECT
  USING (is_active = true);

-- Service Types: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_service_types"
  ON public.homologacao_service_types FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_service_types"
  ON public.homologacao_service_types FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Public can read active homologacao_service_types"
  ON public.homologacao_service_types FOR SELECT
  USING (is_active = true);

-- Schedules: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_schedules"
  ON public.homologacao_schedules FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_schedules"
  ON public.homologacao_schedules FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Public can read active homologacao_schedules"
  ON public.homologacao_schedules FOR SELECT
  USING (is_active = true);

-- Professional Services: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_professional_services"
  ON public.homologacao_professional_services FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_professional_services"
  ON public.homologacao_professional_services FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Public can read homologacao_professional_services"
  ON public.homologacao_professional_services FOR SELECT
  USING (true);

-- Blocks: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_blocks"
  ON public.homologacao_blocks FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_blocks"
  ON public.homologacao_blocks FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "Public can read homologacao_blocks"
  ON public.homologacao_blocks FOR SELECT
  USING (true);

-- Appointments: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_appointments"
  ON public.homologacao_appointments FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_appointments"
  ON public.homologacao_appointments FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

-- Notifications: Super Admins e Clinic Admins podem gerenciar
CREATE POLICY "Super admins can manage all homologacao_notifications"
  ON public.homologacao_notifications FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Clinic admins can manage their homologacao_notifications"
  ON public.homologacao_notifications FOR ALL
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

-- =====================================================
-- TRIGGER PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_homologacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_homologacao_settings_updated_at
  BEFORE UPDATE ON public.homologacao_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_homologacao_updated_at();

CREATE TRIGGER update_homologacao_professionals_updated_at
  BEFORE UPDATE ON public.homologacao_professionals
  FOR EACH ROW EXECUTE FUNCTION public.update_homologacao_updated_at();

CREATE TRIGGER update_homologacao_appointments_updated_at
  BEFORE UPDATE ON public.homologacao_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_homologacao_updated_at();