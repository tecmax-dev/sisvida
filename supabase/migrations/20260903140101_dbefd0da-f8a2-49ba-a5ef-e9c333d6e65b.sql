CREATE OR REPLACE FUNCTION public.validate_authorization_full(p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ua.id,
    'authorization_number', ua.authorization_number,
    'validation_hash', ua.validation_hash,
    'status', ua.status,
    'valid_from', ua.valid_from,
    'valid_until', ua.valid_until,
    'issued_at', COALESCE(ua.issued_at, ua.created_at),
    'notes', ua.notes,
    'clinic_id', ua.clinic_id,
    'created_at', ua.created_at,
    'view_count', ua.view_count,
    'is_for_dependent', ua.is_for_dependent,
    'revoked_at', ua.revoked_at,
    'revocation_reason', ua.revocation_reason,
    'patient', jsonb_build_object('name', p.name, 'cpf', p.cpf, 'registration_number', p.registration_number),
    'dependent', CASE WHEN pd.id IS NOT NULL THEN jsonb_build_object('name', pd.name, 'cpf', pd.cpf) ELSE NULL END,
    'benefit', CASE WHEN ub.id IS NOT NULL THEN jsonb_build_object('name', ub.name, 'partner_name', ub.partner_name, 'partner_address', ub.partner_address, 'partner_phone', ub.partner_phone) ELSE NULL END,
    'clinic', jsonb_build_object('name', c.name),
    'union_entity', CASE WHEN ue.id IS NOT NULL THEN jsonb_build_object(
      'razao_social', ue.razao_social,
      'nome_fantasia', ue.nome_fantasia,
      'logo_url', ue.logo_url,
      'president_name', ue.president_name,
      'president_signature_url', ue.president_signature_url
    ) ELSE NULL END
  ) INTO result
  FROM public.union_authorizations ua
  LEFT JOIN public.patients p ON p.id = ua.patient_id
  LEFT JOIN public.patient_dependents pd ON pd.id = ua.dependent_id
  LEFT JOIN public.union_benefits ub ON ub.id = ua.benefit_id
  LEFT JOIN public.clinics c ON c.id = ua.clinic_id
  LEFT JOIN public.union_entities ue ON ue.id = ua.union_entity_id
  WHERE ua.validation_hash = p_hash
  LIMIT 1;

  IF result IS NOT NULL THEN
    UPDATE public.union_authorizations SET view_count = COALESCE(view_count,0) + 1, last_viewed_at = now() WHERE validation_hash = p_hash;
  END IF;

  RETURN result;
END;
$function$;