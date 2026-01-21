-- Corrigir duplicação residual de profissional José Alcides
-- Estratégia: inativar duplicado ANTES de transferir user_id para evitar trigger

-- ============================================================================
-- 1) Clínica 89e7585e-7bce-4e58-91fa-c37080d1170d
--    Manter: 5d6815c1-d176-411d-9a58-d99b89202696 (81 appointments)
--    Inativar: e694fed1-12ec-44c8-83e3-5cc52995d461 (0 appointments, tem user_id)
-- ============================================================================

-- 1.1) Reapontar referências do duplicado para o original (antes de inativar)
UPDATE public.user_roles
SET professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.whatsapp_booking_sessions
SET selected_professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE selected_professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.professional_specialties
SET professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.professional_procedures
SET professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.professional_insurance_plans
SET professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.professional_schedule_exceptions
SET professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.waiting_list
SET professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

UPDATE public.patients
SET no_show_blocked_professional_id = '5d6815c1-d176-411d-9a58-d99b89202696'
WHERE no_show_blocked_professional_id = 'e694fed1-12ec-44c8-83e3-5cc52995d461';

-- 1.2) Inativar o duplicado PRIMEIRO (ele tem user_id, isso remove do trigger check)
UPDATE public.professionals
SET is_active = false,
    name = '[DUPLICADO] ' || name,
    updated_at = now()
WHERE id = 'e694fed1-12ec-44c8-83e3-5cc52995d461'
  AND is_active = true;

-- 1.3) Agora que o duplicado está inativo, transferir user_id para o original
UPDATE public.professionals
SET user_id = '2dc854ef-8678-431f-865d-9c58d2d98e6b',
    updated_at = now()
WHERE id = '5d6815c1-d176-411d-9a58-d99b89202696'
  AND user_id IS NULL;


-- ============================================================================
-- 2) Clínica 1a6cd6f4-4f56-4554-a6a2-96cc550921ed
--    Manter: 59cadc5a-9633-499f-916f-b9f23180ccc7 (tem CRM)
--    Inativar: 9bc474ac-dec7-40ba-978a-776213347f4d (sem CRM)
-- ============================================================================

UPDATE public.user_roles
SET professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.whatsapp_booking_sessions
SET selected_professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE selected_professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.professional_specialties
SET professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.professional_procedures
SET professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.professional_insurance_plans
SET professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.professional_schedule_exceptions
SET professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.waiting_list
SET professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.patients
SET no_show_blocked_professional_id = '59cadc5a-9633-499f-916f-b9f23180ccc7'
WHERE no_show_blocked_professional_id = '9bc474ac-dec7-40ba-978a-776213347f4d';

UPDATE public.professionals
SET is_active = false,
    name = '[DUPLICADO] ' || name,
    updated_at = now()
WHERE id = '9bc474ac-dec7-40ba-978a-776213347f4d'
  AND is_active = true;


-- ============================================================================
-- 3) Prevenção: unicidade por registro profissional (quando existir)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_professionals_clinic_registration_unique
ON public.professionals (
  clinic_id,
  upper(regexp_replace(registration_number, '[^A-Za-z0-9]', '', 'g')),
  coalesce(state, ''),
  coalesce(council_type, '')
)
WHERE is_active = true AND registration_number IS NOT NULL;


-- ============================================================================
-- 4) Atualizar trigger para também validar registration_number
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_professional_duplicate()
RETURNS TRIGGER AS $$
DECLARE
  existing_id uuid;
  existing_name text;
  reg_norm text;
BEGIN
  -- REGRA 1: 1 profissional ativo por (clinic_id, user_id)
  IF NEW.user_id IS NOT NULL AND NEW.is_active = true THEN
    SELECT id, name INTO existing_id, existing_name
    FROM public.professionals
    WHERE clinic_id = NEW.clinic_id
      AND user_id = NEW.user_id
      AND is_active = true
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'PROFISSIONAL_DUPLICADO: Já existe um profissional ativo (%) vinculado a este usuário nesta clínica.', existing_name;
    END IF;
  END IF;

  -- REGRA 2: 1 profissional ativo por (clinic_id, registration_number normalizado)
  IF NEW.is_active = true AND NEW.registration_number IS NOT NULL THEN
    reg_norm := upper(regexp_replace(NEW.registration_number, '[^A-Za-z0-9]', '', 'g'));

    SELECT id, name INTO existing_id, existing_name
    FROM public.professionals
    WHERE clinic_id = NEW.clinic_id
      AND is_active = true
      AND registration_number IS NOT NULL
      AND upper(regexp_replace(registration_number, '[^A-Za-z0-9]', '', 'g')) = reg_norm
      AND coalesce(state, '') = coalesce(NEW.state, '')
      AND coalesce(council_type, '') = coalesce(NEW.council_type, '')
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'PROFISSIONAL_DUPLICADO_REG: Já existe um profissional ativo (%) com este registro nesta clínica.', existing_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Garantir que o trigger existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_professional_duplicate'
  ) THEN
    CREATE TRIGGER trg_check_professional_duplicate
    BEFORE INSERT OR UPDATE ON public.professionals
    FOR EACH ROW
    EXECUTE FUNCTION public.check_professional_duplicate();
  END IF;
END $$;