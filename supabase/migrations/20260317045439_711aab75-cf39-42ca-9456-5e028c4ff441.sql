CREATE OR REPLACE FUNCTION public.authenticate_patient_hybrid(p_cpf text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_patient RECORD;
  v_auth_user_id UUID;
  v_email TEXT;
  v_new_app_meta jsonb;
BEGIN
  SELECT * INTO v_patient
  FROM public.verify_patient_password(p_cpf, p_password)
  LIMIT 1;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;

  IF v_patient.patient_email IS NULL OR v_patient.patient_email = '' THEN
    v_email := 'paciente_' || regexp_replace(p_cpf, '[^0-9]', '', 'g') || '@app.internal';
  ELSE
    v_email := v_patient.patient_email;
  END IF;

  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_auth_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
      'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), NOW(),
      jsonb_build_object('provider', 'custom', 'patient_id', v_patient.patient_id, 'clinic_id', v_patient.clinic_id),
      jsonb_build_object('name', v_patient.patient_name),
      NOW(), NOW(), '', '', '', ''
    )
    RETURNING id INTO v_auth_user_id;
  ELSE
    v_new_app_meta := jsonb_set(
      coalesce((SELECT raw_app_meta_data FROM auth.users WHERE id = v_auth_user_id), '{}'::jsonb),
      '{provider}', '"custom"'::jsonb, true
    );
    v_new_app_meta := jsonb_set(v_new_app_meta, '{patient_id}', to_jsonb(v_patient.patient_id), true);
    v_new_app_meta := jsonb_set(v_new_app_meta, '{clinic_id}', to_jsonb(v_patient.clinic_id), true);

    UPDATE auth.users
    SET raw_app_meta_data = v_new_app_meta,
        encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_auth_user_id;
  END IF;

  RETURN jsonb_build_object(
    'patient_id', v_patient.patient_id,
    'clinic_id', v_patient.clinic_id,
    'patient_name', v_patient.patient_name,
    'patient_email', v_email,
    'is_active', v_patient.is_active,
    'auth_user_id', v_auth_user_id
  );
END;
$function$;