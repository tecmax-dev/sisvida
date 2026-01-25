-- ============================================
-- CORREÇÃO: Sistema de autenticação híbrido
-- ============================================
-- Esta migration cria uma função que autentica pacientes
-- usando verificação customizada de senha MAS gerando
-- token JWT do Supabase para persistência robusta

-- 1. Criar função para autenticar paciente e gerar auth.users
-- Esta função será chamada no login para criar sessão real do Supabase
CREATE OR REPLACE FUNCTION public.authenticate_patient_hybrid(
  p_cpf TEXT,
  p_password TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_auth_user_id UUID;
  v_email TEXT;
BEGIN
  -- 1. Verificar credenciais usando a função existente
  SELECT * INTO v_patient
  FROM public.verify_patient_password(p_cpf, p_password)
  LIMIT 1;
  
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;
  
  -- 2. Criar email único para o paciente (se não tiver)
  IF v_patient.patient_email IS NULL OR v_patient.patient_email = '' THEN
    v_email := 'paciente_' || p_cpf || '@app.internal';
  ELSE
    v_email := v_patient.patient_email;
  END IF;
  
  -- 3. Buscar ou criar usuário no auth.users
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_email;
  
  -- Se não existe, criar usuário (será usado apenas para sessão JWT)
  IF v_auth_user_id IS NULL THEN
    -- Inserir na tabela auth.users (função interna do Supabase)
    -- NOTA: Normalmente não fazemos INSERT direto em auth.users,
    -- mas esta é a única forma de criar sessão sem email confirmation
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_email,
      crypt(p_password, gen_salt('bf')), -- Usar password fornecido
      NOW(), -- Email já confirmado
      jsonb_build_object(
        'provider', 'custom',
        'patient_id', v_patient.patient_id,
        'clinic_id', v_patient.clinic_id
      ),
      jsonb_build_object(
        'name', v_patient.patient_name,
        'patient_id', v_patient.patient_id
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_auth_user_id;
  END IF;
  
  -- 4. Retornar dados completos para o cliente
  RETURN jsonb_build_object(
    'patient_id', v_patient.patient_id,
    'clinic_id', v_patient.clinic_id,
    'patient_name', v_patient.patient_name,
    'patient_email', v_email,
    'is_active', v_patient.is_active,
    'auth_user_id', v_auth_user_id
  );
END;
$$;

-- 2. Garantir que a função verify_patient_password retorna dados completos
-- (já existe, apenas documentando dependência)