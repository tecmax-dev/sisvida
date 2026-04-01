-- Create more complete RPCs for public pages that need related data

-- Authorization validation with full related data
CREATE OR REPLACE FUNCTION public.validate_authorization_full(p_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'notes', ua.notes,
    'clinic_id', ua.clinic_id,
    'created_at', ua.created_at,
    'view_count', ua.view_count,
    'is_for_dependent', ua.is_for_dependent,
    'revoked_at', ua.revoked_at,
    'revocation_reason', ua.revocation_reason,
    'patient', jsonb_build_object('name', p.name, 'cpf', p.cpf, 'registration_number', p.registration_number),
    'dependent', CASE WHEN pd.id IS NOT NULL THEN jsonb_build_object('name', pd.name) ELSE NULL END,
    'benefit', CASE WHEN ub.id IS NOT NULL THEN jsonb_build_object('name', ub.name, 'partner_name', ub.partner_name) ELSE NULL END,
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
  
  -- Increment view count
  IF result IS NOT NULL THEN
    UPDATE public.union_authorizations SET view_count = view_count + 1 WHERE validation_hash = p_hash;
  END IF;
  
  RETURN result;
END;
$$;

-- Anamnese response lookup by token with related data
CREATE OR REPLACE FUNCTION public.get_anamnese_by_public_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ar.id,
    'template_id', ar.template_id,
    'patient_id', ar.patient_id,
    'clinic_id', ar.clinic_id,
    'filled_by_patient', ar.filled_by_patient,
    'patient', jsonb_build_object('name', p.name),
    'template', jsonb_build_object('title', at2.title, 'description', at2.description),
    'clinic', jsonb_build_object('name', c.name)
  ) INTO result
  FROM public.anamnese_responses ar
  LEFT JOIN public.patients p ON p.id = ar.patient_id
  LEFT JOIN public.anamnese_templates at2 ON at2.id = ar.template_id
  LEFT JOIN public.clinics c ON c.id = ar.clinic_id
  WHERE ar.public_token = p_token
  LIMIT 1;
  
  RETURN result;
END;
$$;

-- Contribution lookup by public access token  
CREATE OR REPLACE FUNCTION public.get_contribution_by_public_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ec.id,
    'status', ec.status,
    'value', ec.value,
    'due_date', ec.due_date,
    'competence_month', ec.competence_month,
    'competence_year', ec.competence_year,
    'lytex_invoice_url', ec.lytex_invoice_url,
    'employer_id', ec.employer_id,
    'contribution_type_id', ec.contribution_type_id,
    'clinic_id', ec.clinic_id
  ) INTO result
  FROM public.employer_contributions ec
  WHERE ec.public_access_token = p_token
  LIMIT 1;
  
  RETURN result;
END;
$$;