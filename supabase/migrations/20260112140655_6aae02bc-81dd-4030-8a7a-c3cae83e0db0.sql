
-- =====================================================
-- CORREÇÃO COMPLETA DE RLS PARA AGENDA DE HOMOLOGAÇÃO
-- =====================================================

-- 1. Criar função para verificar acesso ao módulo sindical/homologação
CREATE OR REPLACE FUNCTION public.has_union_homologacao_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Verifica se é super admin (usando função existente)
  SELECT is_super_admin(_user_id)
  OR
  -- Verifica se tem role na clínica
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND clinic_id = _clinic_id
  )
  OR
  -- Verifica se é profissional ativo na clínica
  EXISTS (
    SELECT 1 FROM public.professionals
    WHERE user_id = _user_id AND clinic_id = _clinic_id AND is_active = true
  )
  OR
  -- Verifica se é responsável por um sindicato vinculado à clínica (usando enum correto 'ativa')
  EXISTS (
    SELECT 1 FROM public.union_entities
    WHERE (user_id = _user_id OR clinic_id = _clinic_id)
    AND status = 'ativa'::union_entity_status
  )
$$;

-- 2. Criar tabela de log de notificações de homologação (se não existir)
CREATE TABLE IF NOT EXISTS public.homologacao_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.homologacao_appointments(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient_phone text,
  recipient_email text,
  message text,
  protocol_sent boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS na tabela de logs
ALTER TABLE public.homologacao_notification_logs ENABLE ROW LEVEL SECURITY;

-- 3. REMOVER TODAS AS POLICIES PERMISSIVAS EXISTENTES
DROP POLICY IF EXISTS "Public can check appointment availability" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "Public can create homologacao_appointments" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_appointments" ON public.homologacao_appointments;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_appointments" ON public.homologacao_appointments;

DROP POLICY IF EXISTS "Public can read homologacao_blocks" ON public.homologacao_blocks;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_blocks" ON public.homologacao_blocks;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_blocks" ON public.homologacao_blocks;

DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_notifications" ON public.homologacao_notifications;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_notifications" ON public.homologacao_notifications;

DROP POLICY IF EXISTS "Public can read homologacao_professional_services" ON public.homologacao_professional_services;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_professional_service" ON public.homologacao_professional_services;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_professional_services" ON public.homologacao_professional_services;

DROP POLICY IF EXISTS "Public can read active homologacao_professionals" ON public.homologacao_professionals;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_professionals" ON public.homologacao_professionals;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_professionals" ON public.homologacao_professionals;

DROP POLICY IF EXISTS "Public can read active homologacao_schedules" ON public.homologacao_schedules;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_schedules" ON public.homologacao_schedules;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_schedules" ON public.homologacao_schedules;

DROP POLICY IF EXISTS "Public can read active homologacao_service_types" ON public.homologacao_service_types;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_service_types" ON public.homologacao_service_types;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_service_types" ON public.homologacao_service_types;

DROP POLICY IF EXISTS "Public can read homologacao_settings" ON public.homologacao_settings;
DROP POLICY IF EXISTS "Clinic admins can manage their homologacao_settings" ON public.homologacao_settings;
DROP POLICY IF EXISTS "Super admins can manage all homologacao_settings" ON public.homologacao_settings;

-- 4. CRIAR NOVAS POLICIES SEGURAS PARA homologacao_appointments

-- SELECT: apenas usuários autenticados com acesso à clínica
CREATE POLICY "select_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR SELECT
TO authenticated
USING (
  has_union_homologacao_access(auth.uid(), clinic_id)
);

-- INSERT: apenas usuários autenticados com acesso à clínica
CREATE POLICY "insert_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR INSERT
TO authenticated
WITH CHECK (
  has_union_homologacao_access(auth.uid(), clinic_id)
);

-- UPDATE: apenas usuários autenticados com acesso à clínica
CREATE POLICY "update_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR UPDATE
TO authenticated
USING (
  has_union_homologacao_access(auth.uid(), clinic_id)
)
WITH CHECK (
  has_union_homologacao_access(auth.uid(), clinic_id)
);

-- DELETE: apenas usuários autenticados com acesso à clínica (soft delete via status)
CREATE POLICY "delete_homologacao_appointments_by_clinic_access"
ON public.homologacao_appointments
FOR DELETE
TO authenticated
USING (
  has_union_homologacao_access(auth.uid(), clinic_id)
);

-- 5. CRIAR POLICIES PARA homologacao_blocks
CREATE POLICY "select_homologacao_blocks_by_clinic_access"
ON public.homologacao_blocks
FOR SELECT
TO authenticated
USING (
  has_union_homologacao_access(auth.uid(), clinic_id)
);

CREATE POLICY "insert_homologacao_blocks_by_clinic_access"
ON public.homologacao_blocks
FOR INSERT
TO authenticated
WITH CHECK (
  has_union_homologacao_access(auth.uid(), clinic_id)
);

CREATE POLICY "update_homologacao_blocks_by_clinic_access"
ON public.homologacao_blocks
FOR UPDATE
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "delete_homologacao_blocks_by_clinic_access"
ON public.homologacao_blocks
FOR DELETE
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

-- 6. CRIAR POLICIES PARA homologacao_professionals
CREATE POLICY "select_homologacao_professionals_by_clinic_access"
ON public.homologacao_professionals
FOR SELECT
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "manage_homologacao_professionals_by_clinic_access"
ON public.homologacao_professionals
FOR ALL
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- 7. CRIAR POLICIES PARA homologacao_schedules
CREATE POLICY "select_homologacao_schedules_by_clinic_access"
ON public.homologacao_schedules
FOR SELECT
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "manage_homologacao_schedules_by_clinic_access"
ON public.homologacao_schedules
FOR ALL
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- 8. CRIAR POLICIES PARA homologacao_service_types
CREATE POLICY "select_homologacao_service_types_by_clinic_access"
ON public.homologacao_service_types
FOR SELECT
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "manage_homologacao_service_types_by_clinic_access"
ON public.homologacao_service_types
FOR ALL
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- 9. CRIAR POLICIES PARA homologacao_settings
CREATE POLICY "select_homologacao_settings_by_clinic_access"
ON public.homologacao_settings
FOR SELECT
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "manage_homologacao_settings_by_clinic_access"
ON public.homologacao_settings
FOR ALL
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- 10. CRIAR POLICIES PARA homologacao_professional_services
CREATE POLICY "select_homologacao_professional_services_by_clinic_access"
ON public.homologacao_professional_services
FOR SELECT
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "manage_homologacao_professional_services_by_clinic_access"
ON public.homologacao_professional_services
FOR ALL
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id))
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- 11. CRIAR POLICIES PARA homologacao_notifications (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'homologacao_notifications') THEN
    EXECUTE 'CREATE POLICY "select_homologacao_notifications_by_clinic_access"
    ON public.homologacao_notifications
    FOR SELECT
    TO authenticated
    USING (has_union_homologacao_access(auth.uid(), clinic_id))';
    
    EXECUTE 'CREATE POLICY "manage_homologacao_notifications_by_clinic_access"
    ON public.homologacao_notifications
    FOR ALL
    TO authenticated
    USING (has_union_homologacao_access(auth.uid(), clinic_id))
    WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id))';
  END IF;
END $$;

-- 12. CRIAR POLICIES PARA homologacao_notification_logs
CREATE POLICY "select_homologacao_notification_logs_by_clinic_access"
ON public.homologacao_notification_logs
FOR SELECT
TO authenticated
USING (has_union_homologacao_access(auth.uid(), clinic_id));

CREATE POLICY "insert_homologacao_notification_logs_by_clinic_access"
ON public.homologacao_notification_logs
FOR INSERT
TO authenticated
WITH CHECK (has_union_homologacao_access(auth.uid(), clinic_id));

-- 13. Criar função para gerar protocolo automaticamente
CREATE OR REPLACE FUNCTION public.generate_homologacao_protocol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date_part text;
  v_sequence int;
  v_protocol text;
BEGIN
  -- Gerar protocolo apenas quando status mudar para 'attended' ou ao criar com status 'attended'
  IF (NEW.status = 'attended' AND (OLD IS NULL OR OLD.status != 'attended')) THEN
    -- Formato: HOM-YYYYMMDD-SEQUENCIAL
    v_date_part := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    -- Obter próximo sequencial do dia
    SELECT COALESCE(MAX(
      CASE 
        WHEN protocol_number LIKE 'HOM-' || v_date_part || '-%' 
        THEN NULLIF(regexp_replace(protocol_number, '^HOM-\d{8}-', ''), '')::int
        ELSE 0 
      END
    ), 0) + 1
    INTO v_sequence
    FROM homologacao_appointments
    WHERE clinic_id = NEW.clinic_id
    AND protocol_number LIKE 'HOM-' || v_date_part || '-%';
    
    v_protocol := 'HOM-' || v_date_part || '-' || LPAD(v_sequence::text, 4, '0');
    NEW.protocol_number := v_protocol;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_generate_homologacao_protocol ON public.homologacao_appointments;

-- Criar trigger para gerar protocolo
CREATE TRIGGER trigger_generate_homologacao_protocol
BEFORE INSERT OR UPDATE ON public.homologacao_appointments
FOR EACH ROW
EXECUTE FUNCTION public.generate_homologacao_protocol();

-- 14. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_homologacao_appointments_clinic_status 
ON public.homologacao_appointments(clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_homologacao_appointments_date 
ON public.homologacao_appointments(appointment_date);

CREATE INDEX IF NOT EXISTS idx_homologacao_notification_logs_appointment 
ON public.homologacao_notification_logs(appointment_id);

-- 15. Habilitar Realtime para homologacao_appointments respeitando RLS
ALTER PUBLICATION supabase_realtime ADD TABLE public.homologacao_appointments;
